/* Reconnaissance vocale (Web Speech API) — dictée en français, mode continu */
const Speech = (() => {
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SpeechRecognitionImpl;

  const ERROR_MESSAGES = {
    'not-allowed': "Accès au microphone refusé. Autorisez le micro dans les réglages du navigateur pour dicter.",
    'service-not-allowed': "Accès au microphone refusé par le navigateur ou le système.",
    'audio-capture': "Aucun microphone détecté. Vérifiez qu'un micro est bien connecté.",
    'no-speech': "Aucune parole détectée. Rapprochez-vous du micro et réessayez.",
    'network': "Problème réseau : la reconnaissance vocale nécessite une connexion internet.",
    'aborted': "Dictée interrompue.",
    'language-not-supported': "La langue française n'est pas prise en charge par ce navigateur.",
    'bad-grammar': "Erreur de reconnaissance vocale.",
  };

  function messageForError(errorCode) {
    return ERROR_MESSAGES[errorCode] || `Erreur de reconnaissance vocale (${errorCode}).`;
  }

  class SpeechController {
    constructor({ onInterim, onFinal, onStart, onEnd, onError } = {}) {
      this.onInterim = onInterim || (() => {});
      this.onFinal = onFinal || (() => {});
      this.onStart = onStart || (() => {});
      this.onEnd = onEnd || (() => {});
      this.onError = onError || (() => {});
      this.recognition = null;
      this.listening = false;
    }

    _createRecognition() {
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        this.listening = true;
        this.onStart();
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (final) this.onFinal(final);
        if (interim) this.onInterim(interim);
      };

      recognition.onerror = (event) => {
        this.onError(messageForError(event.error), event.error);
      };

      // Pas de redémarrage automatique : l'utilisateur relance manuellement.
      recognition.onend = () => {
        this.listening = false;
        this.onEnd();
      };

      return recognition;
    }

    start() {
      if (!isSupported) {
        this.onError("La dictée vocale n'est pas prise en charge par ce navigateur. Essayez Chrome ou Edge.", 'unsupported');
        return false;
      }
      if (this.listening) return true;
      try {
        this.recognition = this._createRecognition();
        this.recognition.start();
        return true;
      } catch (err) {
        this.onError("Impossible de démarrer la dictée vocale.", 'start-failed');
        return false;
      }
    }

    stop() {
      if (this.recognition && this.listening) {
        this.recognition.stop();
      }
    }
  }

  return { isSupported, SpeechController };
})();
