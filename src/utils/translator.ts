import translate from 'google-translate-api-x';

export async function translateMessage(message: string, toLanguage: string = 'ru') {
    try {
        const translation = await translate(message, { to: toLanguage });
        return translation.text || message;
    } catch (error) {
        console.error('Error translating message:', error);
        return message;
    }
}
