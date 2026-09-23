import { GoogleGenAI, Type } from "@google/genai";

export const getGrandmaAdvice = async (userPrompt: string, availableProducts: string[]) => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "undefined") {
    return {
      message: "Oi, minha flor! A vovó tá ocupada no fogão agora, mas me chama no WhatsApp que eu te ajudo!",
      suggestedItems: ["Coxinha de Frango"]
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const productsContext = availableProducts.length > 0 
      ? availableProducts.join(", ") 
      : "Coxinha, Empanada, Quibe, Bolinha de Queijo";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction: `Você é a Vovó Grazy. Sua comida é CASEIRA, feita por você e pela sua filha (a mãe do cliente). Não use termos como 'gourmet' ou 'artesanal'. 
        
        LINGUAGEM:
        - Seja direta mas gentil. Use "querida", "meu anjo" ou "meu filho".
        - Fale sobre o tempero de casa, que o salgado é frito na hora e a Massa com tempero de Mãe.
        - Evite repetir a palavra "carinho" toda hora. Use "caprichado", "quentinho", "feito com amor".
        
        REGRAS:
        - Use apenas os produtos: [${productsContext}].
        - Se pedirem algo que não tem, sugira o mais parecido do cardápio.
        - Seu marido é Argentino, as empanadas dele são o carro-chefe!
        
        Responda em JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            suggestedItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["message", "suggestedItems"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    return {
      message: "Oi querida! O óleo já tá quente, escolhe aí o que você quer comer hoje que a gente capricha!",
      suggestedItems: availableProducts.slice(0, 2)
    };
  }
};