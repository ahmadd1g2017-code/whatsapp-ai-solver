const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

class AISolver {
  constructor() {
    this.keys = [...config.GEMINI_KEYS];
    this.currentKeyIndex = 0;
  }

  getCurrentKey() {
    return this.keys[this.currentKeyIndex % this.keys.length];
  }

  rotateKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
    console.log(`[AISolver] Rotated to key index: ${this.currentKeyIndex}`);
  }

  /**
   * Solves a question (text or image) received from Darsel / Educational bot.
   * @param {Object} params
   * @param {string} [params.text] - The message text or caption
   * @param {Buffer} [params.imageBuffer] - The image buffer if an image was sent
   * @param {string} [params.imageMime] - MIME type of the image
   * @returns {Promise<{ answer: string, model: string, durationMs: number }>}
   */
  async solveQuestion({ text = '', imageBuffer = null, imageMime = 'image/jpeg' }) {
    const startTime = Date.now();
    const systemPrompt = `أنت خبير ذكاء اصطناعي متخصص في حل الأسئلة والتمارين التعليمية بدقة متناهية وسرعة فائقة على تطبيق واتساب (الموجّهة لنظام وروبوت منصة Darsel التعليمية).

مهمتك الأساسية:
1. قراءة وفهم السؤال أو التمرين بدقة تامة، سواء كان نصاً أو صورة (معادلة، رسم هندسي، مثلثات، زوايا، كسور، خيارات، لافتة).
2. حل السؤال خطوة بخطوة رياضياً/علمياً في عقلك للتأكد من صحة النتيجة بنسبة 100%.
3. صياغة الإجابة لتناسب روبوتات التصحيح الآلي (Automated Grader) مثل Darsel دون أي كلام زائد قد يسبب رسوب الإجابة.

قواعد صارمة جداً لتنسيق الإجابة (اتبعها بدقة):
- أسئلة الاختيار من متعدد (Multiple Choice):
  * إذا كان السؤال يحتوي على خيارات مرقمة (1, 2, 3, 4) ويطلب إرسال رقم الإجابة: أرسل رقم الخيار الصحيح فقط (مثال: "2" أو "1") دون أي كلمة أخرى!
  * إذا كانت الخيارات حروفا (A, B, C, D أو أ، ب، ج، د): أرسل الحرف الصحيح فقط.
  * لا تكتب "الجواب هو 2" أو "خيار 2"، بل اكتب فقط: 2.

- أسئلة الإجابة الرقمية المباشرة (Numeric Answer):
  * إذا سأل عن قيمة عددية (مثلاً: ما قيمة x؟ كم ناتج 12 * 8؟): أرسل القيمة العددية فقط (مثال: "96" أو "5.4" أو "-3").

- رسائل الأوامر والمتابعة التفاعلية (Interactive Commands):
  * إذا أرسل Darsel رسالة تطلب تأكيداً مثل: "أرسل 1 للبدء"، "أرسل نعم للمتابعة"، "هل أنت مستعد؟": أرسل مباشرة الكلمة أو الرقم المطلوب (مثال: "1" أو "نعم").

- الأسئلة المقالية أو اللغوية المفتوحة:
  * إذا كان السؤال يتطلب كتابة كلمة معينة أو إجابة نصية، اكتب الإجابة المباشرة بأقل عدد ممكن من الكلمات وبأعلى دقة نحوية وإملائية.

تذكّر دائماً: المتلقي هو روبوت آلي حساس للنصوص الزائدة، لذلك تجنب تماماً المقدمات والشروحات المطولة، وأعط الإجابة المباشرة الصريحة.`;

    const userPrompt = text ? `نص السؤال أو الرسالة الواردة:\n"${text}"` : 'قم بقراءة السؤال الموجود في الصورة وحله.';

    // Try primary models: gemini-3.5-flash, then fallback to gemini-2.5-pro
    const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-pro'];
    let lastError = null;

    for (let attempt = 0; attempt < this.keys.length * modelsToTry.length; attempt++) {
      const currentKey = this.getCurrentKey();
      const currentModelName = modelsToTry[attempt % modelsToTry.length];

      try {
        const genAI = new GoogleGenerativeAI(currentKey);
        const model = genAI.getGenerativeModel({
          model: currentModelName,
          systemInstruction: systemPrompt
        });

        const contents = [];
        if (imageBuffer) {
          contents.push({
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: imageMime || 'image/jpeg'
            }
          });
        }
        contents.push(userPrompt);

        const result = await model.generateContent(contents);
        const rawAnswer = result.response.text();
        const cleanedAnswer = this.cleanAnswer(rawAnswer);

        const durationMs = Date.now() - startTime;
        console.log(`[AISolver] Solved successfully using ${currentModelName} in ${durationMs}ms: "${cleanedAnswer}"`);

        return {
          answer: cleanedAnswer,
          rawAnswer,
          model: currentModelName,
          durationMs
        };
      } catch (err) {
        lastError = err;
        console.warn(`[AISolver] Error with key ${this.currentKeyIndex} and model ${currentModelName}:`, err.message);
        
        // If rate limit (429) or quota error, rotate key
        if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('ResourceExhausted')) {
          this.rotateKey();
        }
      }
    }

    throw new Error(`Failed to solve question after retries: ${lastError ? lastError.message : 'Unknown error'}`);
  }

  /**
   * Cleans the AI answer to ensure it's suitable for Darsel.
   * Strips markdown fences, quotes, trailing dots if single number/option, etc.
   */
  cleanAnswer(answer) {
    if (!answer) return '';
    let cleaned = answer.trim();

    // Remove markdown code fences if any
    cleaned = cleaned.replace(/^```[a-z]*\n([\s\S]*?)\n```$/gi, '$1').trim();

    // If answer is just something like "الإجابة هي: 2" or "الجواب: 3"
    const prefixMatch = cleaned.match(/^(?:الجواب|الإجابة|الحل|الخيار)\s*(?:هو|هي)?\s*[:=\-]?\s*([0-9A-Za-zأ-ي]+)$/i);
    if (prefixMatch && prefixMatch[1]) {
      cleaned = prefixMatch[1].trim();
    }

    // If it's a single number or single letter with a trailing period, remove period (e.g. "2." -> "2")
    if (/^[0-9A-Za-zأ-ي]\.$/.test(cleaned)) {
      cleaned = cleaned.replace(/\.$/, '');
    }

    return cleaned;
  }
}

module.exports = new AISolver();
