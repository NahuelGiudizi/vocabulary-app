"""
Ollama service for sentence generation.

This module provides integration with Ollama for AI-powered
sentence generation using local LLM models.
"""

import httpx
import json
import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import asyncio

from config import settings, THEMES, POS_MAPPING, get_complexity_level, get_complexity_description

logger = logging.getLogger(__name__)


class OllamaConnectionError(Exception):
    """Exception raised when Ollama service is unavailable."""
    pass


class InvalidResponseError(Exception):
    """Exception raised when Ollama returns malformed response."""
    pass


@dataclass
class WordInfo:
    """Data class for word information during generation."""
    lemma: str
    pos: str
    rank: int
    word_id: int


class OllamaService:
    """
    Service for generating example sentences using Ollama.
    
    This service handles:
    - Building prompts based on theme and word complexity
    - Calling Ollama API for sentence generation
    - Parsing and validating responses
    - Error handling and retries
    
    Attributes:
        host: Ollama server URL
        model: Name of the model to use
        timeout: Request timeout in seconds
    """
    
    def __init__(
        self,
        host: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None
    ):
        """
        Initialize OllamaService.
        
        Args:
            host: Ollama server URL (default from settings)
            model: Model name (default from settings)
            timeout: Request timeout in seconds (default from settings)
        """
        self.host = host or settings.OLLAMA_HOST
        self.model = model or settings.OLLAMA_MODEL
        self.timeout = timeout or settings.OLLAMA_TIMEOUT
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client
    
    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
    
    async def check_connection(self) -> bool:
        """
        Check if Ollama service is available.
        
        Returns:
            True if Ollama is reachable, False otherwise
        """
        try:
            client = await self._get_client()
            response = await client.get(f"{self.host}/api/tags")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama connection check failed: {str(e)}")
            return False
    
    async def list_models(self) -> List[str]:
        """
        List available models in Ollama.
        
        Returns:
            List of model names
            
        Raises:
            OllamaConnectionError: If Ollama is unavailable
        """
        try:
            client = await self._get_client()
            response = await client.get(f"{self.host}/api/tags")
            response.raise_for_status()
            data = response.json()
            return [model["name"] for model in data.get("models", [])]
        except httpx.HTTPError as e:
            raise OllamaConnectionError(f"Failed to list models: {str(e)}")
    
    def _build_prompt(
        self,
        words: List[WordInfo],
        theme: str,
        sentences_per_word: int = 3
    ) -> str:
        """
        Build the prompt for sentence generation.
        
        Args:
            words: List of WordInfo objects to generate sentences for
            theme: Theme key for context
            sentences_per_word: Number of sentences per word
            
        Returns:
            Formatted prompt string
        """
        theme_config = THEMES.get(theme, THEMES["qa_manager"])
        theme_name = theme_config["name"]
        theme_context = theme_config["context"]
        
        # Build word list with specific instructions per POS
        word_entries = []
        for word in words:
            pos_name = POS_MAPPING.get(word.pos, {}).get("name", "Unknown")
            pos_instruction = self._get_pos_instruction(word.lemma, word.pos)
            
            word_entries.append(
                f'Word: "{word.lemma}"\n'
                f'Part of Speech: {pos_name} ({word.pos})\n'
                f'Instruction: {pos_instruction}'
            )
        
        word_list = "\n\n".join(word_entries)
        
        prompt = f"""You are a linguistics expert creating example sentences for English learners.

PROFESSIONAL CONTEXT: {theme_context}

TASK: Generate exactly {sentences_per_word} sentences for each word below. Each sentence MUST use the word in the EXACT grammatical role specified.

=== WORDS TO PROCESS ===

{word_list}

=== OUTPUT FORMAT ===
Return ONLY a JSON array. No explanations, no markdown:
[{{"lemma": "word", "pos": "x", "sentences": ["sentence1", "sentence2", "sentence3"]}}]"""

        return prompt
    
    def _get_pos_instruction(self, lemma: str, pos: str) -> str:
        """Get specific instruction for how to use word based on POS."""
        lemma_upper = lemma.upper()
        
        instructions = {
            'n': f'NOUN: "{lemma}" must be a thing/subject/object. ✓ "The {lemma} failed." ✓ "Check the {lemma}."',
            
            'v': f'VERB: "{lemma}" must be the action. ✓ "We {lemma} daily." ✓ "They will {lemma} it."',
            
            'j': f'ADJECTIVE: "{lemma}" must come BEFORE a noun to describe it. ✓ "The {lemma_upper} report shows..." ✓ "An {lemma_upper} issue occurred." ✗ WRONG: "It is {lemma}." (no noun after)',
            
            'r': f'ADVERB: "{lemma}" must be at the END of a sentence or clause, followed by ONLY a period, comma, or nothing. NO WORDS can follow "{lemma}". ✓ CORRECT: "See the notes above." ✓ CORRECT: "As mentioned above, we fixed it." ✓ CORRECT: "The data shown above is correct." ✗ WRONG: "above the table" ✗ WRONG: "above all else" ✗ WRONG: "above other priorities" - If ANY word follows "{lemma}", it becomes a preposition!',
            
            'i': f'PREPOSITION: "{lemma}" MUST have a noun/object immediately after. ✓ "{lemma_upper} the baseline, we see..." ✓ "Located {lemma_upper} the header." ✗ WRONG: "Listed {lemma_upper}." (no object = adverb)',
            
            'c': f'CONJUNCTION: "{lemma}" connects two clauses or words. ✓ "Fast {lemma_upper} reliable." ✓ "Test {lemma_upper} deploy."',
            
            'p': f'PRONOUN: "{lemma}" replaces a noun. ✓ "{lemma_upper} works well." ✓ "Give it to {lemma_upper}."',
            
            'a': f'ARTICLE: "{lemma}" comes before a noun. ✓ "{lemma_upper} system runs." ✓ "This is {lemma_upper} update."',
            
            'd': f'DETERMINER: "{lemma}" identifies which noun. ✓ "{lemma_upper} tests passed." ✓ "Check {lemma_upper} file."',
            
            'm': f'MODAL: "{lemma}" shows possibility/obligation before a verb. ✓ "We {lemma_upper} deploy." ✓ "It {lemma_upper} work."',
            
            'u': f'INTERJECTION: "{lemma}" is an exclamation. ✓ "{lemma_upper}! It worked." ✓ "{lemma_upper}, that is great."',
            
            'x': f'NEGATION: "{lemma}" is a contraction suffix that attaches to verbs. Use common contractions like "don\'t", "can\'t", "won\'t", "shouldn\'t", "isn\'t", "aren\'t", "doesn\'t", "haven\'t", "wasn\'t", "couldn\'t". ✓ "The test doesn\'t pass." ✓ "We can\'t deploy yet." ✓ "It isn\'t working." ✗ NEVER write "{lemma}" as a separate word.',
            
            't': f'INFINITIVE MARKER: "{lemma}" before base verb. ✓ "Need {lemma_upper} test." ✓ "Ready {lemma_upper} go."',
            
            'e': f'EXISTENTIAL: "{lemma}" in "there is/are" patterns. ✓ "{lemma_upper} is a bug." ✓ "{lemma_upper} are options."',
            
            'g': f'POSSESSIVE: "{lemma}" shows ownership. ✓ "The team{lemma_upper} code." ✓ "Module{lemma_upper} status."',
        }
        
        return instructions.get(pos, f'Use "{lemma}" as {pos}.')
    
    def _parse_response(self, response_text: str, expected_words: List[WordInfo]) -> List[Dict[str, Any]]:
        """
        Parse and validate Ollama response.
        
        Args:
            response_text: Raw response from Ollama
            expected_words: List of words that should be in response
            
        Returns:
            List of parsed word-sentence dictionaries
            
        Raises:
            InvalidResponseError: If response is malformed
        """
        # Try to extract JSON from response
        try:
            # First, try direct parse
            data = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to find JSON array in response
            json_match = re.search(r'\[\s*\{.*\}\s*\]', response_text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                except json.JSONDecodeError:
                    raise InvalidResponseError(f"Could not parse JSON from response: {response_text[:500]}")
            else:
                raise InvalidResponseError(f"No valid JSON found in response: {response_text[:500]}")
        
        if not isinstance(data, list):
            raise InvalidResponseError(f"Response is not a list: {type(data)}")
        
        # Build lookup for expected words with their POS
        expected_lemmas = {w.lemma.lower(): w for w in expected_words}
        
        # Validate structure
        result = []
        
        for item in data:
            if not isinstance(item, dict):
                logger.warning(f"Skipping non-dict item: {item}")
                continue
            
            lemma = item.get("lemma", "").lower()
            sentences = item.get("sentences", [])
            pos = item.get("pos", "")
            
            if not lemma or not sentences:
                logger.warning(f"Skipping item with missing data: {item}")
                continue
            
            if not isinstance(sentences, list):
                sentences = [sentences] if isinstance(sentences, str) else []
            
            # Get the expected word info for POS validation
            word_info = expected_lemmas.get(lemma)
            expected_pos = word_info.pos if word_info else pos
            
            # Filter and validate sentences
            valid_sentences = []
            for s in sentences:
                if not isinstance(s, str) or len(s.strip()) < 10:
                    continue
                
                sentence = s.strip()
                
                # Validate sentence matches expected POS usage
                if self._validate_pos_usage(sentence, lemma, expected_pos):
                    valid_sentences.append(sentence)
                else:
                    logger.debug(f"Filtered sentence for '{lemma}' ({expected_pos}): {sentence}")
            
            if valid_sentences:
                result.append({
                    "lemma": lemma,
                    "pos": pos,
                    "sentences": valid_sentences[:2]  # Keep only best 2
                })
        
        return result
    
    def _validate_pos_usage(self, sentence: str, lemma: str, pos: str) -> bool:
        """
        Validate that a sentence uses the word in the correct POS.
        
        Args:
            sentence: The sentence to validate
            lemma: The word being used
            pos: Expected part of speech
            
        Returns:
            True if the sentence appears to use the word correctly
        """
        sentence_lower = sentence.lower()
        lemma_lower = lemma.lower()
        
        # Find the position of the lemma in the sentence
        lemma_pos = sentence_lower.find(lemma_lower)
        if lemma_pos == -1:
            return False
        
        # Get what comes after the lemma
        after_lemma = sentence_lower[lemma_pos + len(lemma_lower):].strip()
        
        # Get what comes before the lemma
        before_lemma = sentence_lower[:lemma_pos].strip()
        
        if pos == 'r':  # Adverb
            # Adverb should be followed by punctuation or end of clause
            # Valid: "shown above." "mentioned above, we" "data above is"
            # Invalid: "above the table" "above all else"
            if not after_lemma:
                return True  # End of sentence
            first_char = after_lemma[0] if after_lemma else ''
            # Should be followed by punctuation or clause connector
            if first_char in '.,;:!?)':
                return True
            # Check if followed by "is", "are", "was", "were", "has", "have" (still adverb)
            next_word = after_lemma.split()[0] if after_lemma.split() else ''
            if next_word in ['is', 'are', 'was', 'were', 'has', 'have', 'will', 'can', 'could', 'should', 'would', 'may', 'might']:
                return True
            return False
            
        elif pos == 'i':  # Preposition
            # Preposition must be followed by a noun/object (not punctuation)
            if not after_lemma:
                return False  # Can't end sentence
            first_char = after_lemma[0] if after_lemma else ''
            if first_char in '.,;:!?)':
                return False  # Followed by punctuation = adverb
            return True  # Has object after
            
        elif pos == 'j':  # Adjective
            # Adjective should come before a noun (simplified: check if followed by word)
            # Also valid at start: "The ABOVE data"
            if not after_lemma:
                return False
            first_char = after_lemma[0] if after_lemma else ''
            if first_char in '.,;:!?)':
                return False  # Adjective needs noun after
            return True
            
        # For other POS, accept all sentences
        return True
    
    async def generate_sentences_batch(
        self,
        words: List[WordInfo],
        theme: str = "qa_manager",
        sentences_per_word: int = 3,
        max_retries: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Generate example sentences for a batch of words.
        
        Args:
            words: List of WordInfo objects with lemma, pos, rank, word_id
            theme: Theme context for sentence generation
            sentences_per_word: Number of sentences to generate per word
            max_retries: Maximum number of retry attempts
            
        Returns:
            List of dictionaries containing lemma and generated sentences
            
        Raises:
            OllamaConnectionError: If Ollama service is unavailable
            InvalidResponseError: If Ollama returns malformed JSON
        """
        if not words:
            return []
        
        prompt = self._build_prompt(words, theme, sentences_per_word)
        
        logger.info(f"Generating sentences for {len(words)} words with theme '{theme}'")
        
        last_error = None
        for attempt in range(max_retries):
            try:
                client = await self._get_client()
                
                response = await client.post(
                    f"{self.host}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,  # Lower temperature for more precise grammar
                            "top_p": 0.9,
                            "num_predict": 4096
                        }
                    }
                )
                
                response.raise_for_status()
                data = response.json()
                
                response_text = data.get("response", "")
                if not response_text:
                    raise InvalidResponseError("Empty response from Ollama")
                
                result = self._parse_response(response_text, words)
                
                if result:
                    logger.info(f"Successfully generated sentences for {len(result)} words")
                    return result
                else:
                    raise InvalidResponseError("No valid sentences parsed from response")
                
            except httpx.HTTPError as e:
                last_error = OllamaConnectionError(f"HTTP error: {str(e)}")
                logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
            except InvalidResponseError as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1}/{max_retries} - Invalid response: {str(e)}")
            except Exception as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1}/{max_retries} - Unexpected error: {str(e)}")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        raise last_error or OllamaConnectionError("Failed to generate sentences after all retries")
    
    async def generate_single_word(
        self,
        lemma: str,
        pos: str,
        rank: int,
        theme: str = "qa_manager",
        sentences_per_word: int = 3
    ) -> List[str]:
        """
        Generate sentences for a single word.
        
        Args:
            lemma: Base form of the word
            pos: Part of speech code
            rank: Word frequency rank
            theme: Theme context
            sentences_per_word: Number of sentences to generate
            
        Returns:
            List of generated sentences
        """
        word_info = WordInfo(lemma=lemma, pos=pos, rank=rank, word_id=0)
        result = await self.generate_sentences_batch(
            [word_info], theme, sentences_per_word
        )
        
        if result and result[0].get("sentences"):
            return result[0]["sentences"]
        return []


# Singleton instance
_ollama_service: Optional[OllamaService] = None


def get_ollama_service() -> OllamaService:
    """
    Get the singleton OllamaService instance.
    
    Returns:
        OllamaService instance
    """
    global _ollama_service
    if _ollama_service is None:
        _ollama_service = OllamaService()
    return _ollama_service
