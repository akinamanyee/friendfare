import { useEffect, useRef, useState } from "react";

type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechErrorEvent = { error: string };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechResultEvent) => void) | null;
  onerror: ((ev: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const SPEECH_LANGS = [
  { id: "en-US", label: "English" },
  { id: "zh-CN", label: "中文" },
  { id: "ko-KR", label: "한국어" },
  { id: "ja-JP", label: "日本語" },
];

export function useSpeech(lang: string) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    return () => recRef.current?.stop();
  }, []);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Speech to text isn't available in this browser. Type the expense instead.");
      return;
    }
    recRef.current?.stop();
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0]?.transcript ?? "";
      }
      setHeard(text.trim());
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was blocked. You can still type.");
      } else if (event.error === "no-speech") {
        setError("Didn't catch that. Try again, or type it.");
      } else if (event.error !== "aborted") {
        setError("Speech didn't work. Type the expense instead.");
      }
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setHeard("");
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError("Couldn't start the microphone.");
    }
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  return { listening, error, heard, start, stop };
}
