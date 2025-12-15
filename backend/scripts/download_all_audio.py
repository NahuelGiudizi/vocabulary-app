import os
import json
import time
from edge_tts import Communicate

WORDS_JSON = '../../frontend/public/data/words.json'
AUDIO_WORDS_DIR = '../../frontend/public/audio/words'
AUDIO_SENTENCES_DIR = '../../frontend/public/audio/sentences'
VOICE = 'en-US-AriaNeural'

os.makedirs(AUDIO_WORDS_DIR, exist_ok=True)
os.makedirs(AUDIO_SENTENCES_DIR, exist_ok=True)

def sanitize_filename(text):
    return ''.join(c for c in text if c.isalnum() or c in (' ', '_', '-')).rstrip().replace(' ', '_')

def main():
    with open(WORDS_JSON, encoding='utf-8') as f:
        words = json.load(f)

    for word in words:
        lemma = word['lemma']
        word_audio_path = os.path.join(AUDIO_WORDS_DIR, f"{sanitize_filename(lemma)}.mp3")
        if not os.path.exists(word_audio_path):
            print(f"[WORD] {lemma}")
            try:
                communicate = Communicate(lemma, VOICE)
                with open(word_audio_path, 'wb') as out:
                    for chunk in communicate.stream():
                        out.write(chunk)
                time.sleep(0.2)
            except Exception as e:
                print(f"Failed to get audio for word '{lemma}': {e}")

        for sentence in word.get('sentences', []):
            text = sentence.get('text') or sentence.get('sentence_text')
            sid = sentence.get('id')
            if not text or not sid:
                continue
            sent_audio_path = os.path.join(AUDIO_SENTENCES_DIR, f"{sid}.mp3")
            if not os.path.exists(sent_audio_path):
                print(f"[SENTENCE] {sid}")
                try:
                    communicate = Communicate(text, VOICE)
                    with open(sent_audio_path, 'wb') as out:
                        for chunk in communicate.stream():
                            out.write(chunk)
                    time.sleep(0.2)
                except Exception as e:
                    print(f"Failed to get audio for sentence {sid}: {e}")

if __name__ == "__main__":
    main()
