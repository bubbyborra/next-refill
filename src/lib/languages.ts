// Languages the agent can talk in. `bcp47` feeds speech-to-text and turn detection,
// `murfLocale` picks the voice's accent. Greetings are spoken first, word for word.
// `checked` turns true only after a native speaker has read the lines. None are checked yet.

export type LangCode = "te" | "ta" | "hi" | "en" | "kn" | "ml" | "bn" | "mr" | "gu";

export interface Lang {
  code: LangCode;
  name: string;
  native: string;
  bcp47: string;
  murfLocale: string;
  rupees: string; // the word for rupees, used when amounts are spoken
  voiceId: string; // Murf Falcon voice
  voiceGender: "female" | "male";
  filler: string; // said while the agent checks the list
  greeting: string;
  failure: string;
  checked: boolean;
}

export const LANGS: Lang[] = [
  {
    code: "te",
    name: "Telugu",
    native: "తెలుగు",
    bcp47: "te-IN",
    murfLocale: "te-IN",
    rupees: "రూపాయలు",
    voiceId: "en-IN-anisha",
    voiceGender: "female",
    filler: "ఒక్క నిమిషం, చూస్తున్నాను.",
    greeting:
      "నమస్కారం! మీరు ప్రతి నెలా కొనే మందుల పేర్లు చెప్పండి: స్ట్రిప్ మీద ఉన్న పేరు, రోజుకు ఎన్ని, ధర ఎంత. అదే మందు జన ఔషధి స్టోర్‌లో ఎంతకు దొరుకుతుందో, మీకు నెలకు ఎంత మిగులుతుందో చెబుతాను.",
    failure: "క్షమించండి, మళ్ళీ ఒకసారి చెప్పగలరా?",
    checked: false,
  },
  {
    code: "ta",
    name: "Tamil",
    native: "தமிழ்",
    bcp47: "ta-IN",
    murfLocale: "ta-IN",
    rupees: "ரூபாய்",
    voiceId: "ta-IN-karthikeyan",
    voiceGender: "male",
    filler: "ஒரு நிமிடம், பார்க்கிறேன்.",
    greeting:
      "வணக்கம்! நீங்கள் ஒவ்வொரு மாதமும் வாங்கும் மருந்துகளின் பெயர்களைச் சொல்லுங்கள்: ஸ்ட்ரிப்பில் உள்ள பெயர், ஒரு நாளைக்கு எத்தனை, விலை என்ன. அதே மருந்து ஜன் ஔஷதி கடையில் எவ்வளவு, உங்களுக்கு மாதம் எவ்வளவு மிச்சம் என்று சொல்கிறேன்.",
    failure: "மன்னிக்கவும், இன்னொரு முறை சொல்ல முடியுமா?",
    checked: false,
  },
  {
    code: "hi",
    name: "Hindi",
    native: "हिन्दी",
    bcp47: "hi-IN",
    murfLocale: "hi-IN",
    rupees: "रुपये",
    voiceId: "hi-IN-khyati",
    voiceGender: "female",
    filler: "एक मिनट, देख रहे हैं।",
    greeting:
      "नमस्ते! आप हर महीने जो दवाइयाँ खरीदते हैं, उनके नाम बताइए: पत्ते पर लिखा नाम, दिन में कितनी, और दाम कितना। फिर जानिए कि वही दवा जन औषधि केंद्र पर कितने की मिलेगी और हर महीने कितनी बचत होगी।",
    failure: "माफ़ कीजिए, एक बार फिर से बोलेंगे?",
    checked: false,
  },
  {
    code: "en",
    name: "English",
    native: "English",
    bcp47: "en-IN",
    murfLocale: "en-IN",
    rupees: "rupees",
    voiceId: "en-IN-anisha",
    voiceGender: "female",
    filler: "One moment, checking.",
    greeting:
      "Hello! Tell me the medicines you buy every month: the name on the strip, how many a day, and the price. I'll find the same medicine at a Jan Aushadhi store and work out what you save each month.",
    failure: "Sorry, could you say that again?",
    checked: false,
  },
  {
    code: "kn",
    name: "Kannada",
    native: "ಕನ್ನಡ",
    bcp47: "kn-IN",
    murfLocale: "kn-IN",
    rupees: "ರೂಪಾಯಿ",
    voiceId: "kn-IN-harshitha",
    voiceGender: "female",
    filler: "ಒಂದು ನಿಮಿಷ, ನೋಡುತ್ತಿದ್ದೇನೆ.",
    greeting:
      "ನಮಸ್ಕಾರ! ನೀವು ಪ್ರತಿ ತಿಂಗಳು ಖರೀದಿಸುವ ಔಷಧಿಗಳ ಹೆಸರು ಹೇಳಿ: ಸ್ಟ್ರಿಪ್ ಮೇಲಿರುವ ಹೆಸರು, ದಿನಕ್ಕೆ ಎಷ್ಟು, ಬೆಲೆ ಎಷ್ಟು. ಅದೇ ಔಷಧಿ ಜನ ಔಷಧಿ ಕೇಂದ್ರದಲ್ಲಿ ಎಷ್ಟಕ್ಕೆ ಸಿಗುತ್ತದೆ, ನಿಮಗೆ ತಿಂಗಳಿಗೆ ಎಷ್ಟು ಉಳಿತಾಯ ಅಂತ ಹೇಳುತ್ತೇನೆ.",
    failure: "ಕ್ಷಮಿಸಿ, ಇನ್ನೊಮ್ಮೆ ಹೇಳುತ್ತೀರಾ?",
    checked: false,
  },
  {
    code: "ml",
    name: "Malayalam",
    native: "മലയാളം",
    bcp47: "ml-IN",
    murfLocale: "ml-IN",
    rupees: "രൂപ",
    voiceId: "ml-IN-nimisha",
    voiceGender: "female",
    filler: "ഒരു നിമിഷം, നോക്കട്ടെ.",
    greeting:
      "നമസ്കാരം! നിങ്ങൾ എല്ലാ മാസവും വാങ്ങുന്ന മരുന്നുകളുടെ പേര് പറയൂ: സ്ട്രിപ്പിലെ പേര്, ദിവസം എത്ര, വില എത്ര. അതേ മരുന്ന് ജൻ ഔഷധി കടയിൽ എത്ര രൂപയ്ക്ക് കിട്ടുമെന്നും മാസം എത്ര ലാഭിക്കാമെന്നും ഞാൻ പറയാം.",
    failure: "ക്ഷമിക്കണം, ഒന്നുകൂടി പറയാമോ?",
    checked: false,
  },
  {
    code: "bn",
    name: "Bengali",
    native: "বাংলা",
    bcp47: "bn-IN",
    murfLocale: "bn-IN",
    rupees: "টাকা",
    voiceId: "bn-IN-debarati",
    voiceGender: "female",
    filler: "এক মিনিট, দেখছি।",
    greeting:
      "নমস্কার! প্রতি মাসে যে ওষুধগুলো কেনেন, সেগুলোর নাম বলুন: স্ট্রিপে লেখা নাম, দিনে কটা, আর দাম কত। একই ওষুধ জন ঔষধি কেন্দ্রে কত দামে পাবেন আর মাসে কত টাকা বাঁচবে, আমি বলে দেব।",
    failure: "দুঃখিত, আর একবার বলবেন?",
    checked: false,
  },
  {
    code: "mr",
    name: "Marathi",
    native: "मराठी",
    bcp47: "mr-IN",
    murfLocale: "mr-IN",
    rupees: "रुपये",
    voiceId: "mr-IN-prajakta",
    voiceGender: "female",
    filler: "एक मिनिट, पाहूया.",
    greeting:
      "नमस्कार! तुम्ही दर महिन्याला घेता त्या औषधांची नावं सांगा: पट्टीवरचं नाव, दिवसाला किती, आणि किंमत किती. तेच औषध जन औषधी केंद्रात किती रुपयांना मिळेल आणि दर महिन्याला किती बचत होईल ते सांगते.",
    failure: "माफ करा, पुन्हा एकदा सांगाल का?",
    checked: false,
  },
  {
    code: "gu",
    name: "Gujarati",
    native: "ગુજરાતી",
    bcp47: "gu-IN",
    murfLocale: "gu-IN",
    rupees: "રૂપિયા",
    voiceId: "gu-IN-diya",
    voiceGender: "female",
    filler: "એક મિનિટ, જોઉં છું.",
    greeting:
      "નમસ્તે! તમે દર મહિને જે દવાઓ ખરીદો છો તેના નામ કહો: પટ્ટી પરનું નામ, દિવસમાં કેટલી, અને કિંમત કેટલી. એ જ દવા જન ઔષધિ કેન્દ્ર પર કેટલામાં મળશે અને દર મહિને કેટલી બચત થશે, તે કહીશ.",
    failure: "માફ કરશો, ફરી એક વાર કહેશો?",
    checked: false,
  },
];

export function getLang(code: string | null | undefined): Lang {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}
