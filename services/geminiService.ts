
import { GoogleGenAI, Type } from "@google/genai";
import type { Person } from '../types.ts';
import { getFullName } from '../utils/personUtils.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

interface FamilyContext {
    parents: (Person | undefined)[];
    spouses: (Person | undefined)[];
    children: (Person | undefined)[];
}

export const generateLifeStory = async (person: Person, familyContext: FamilyContext): Promise<string> => {

    const { parents, spouses, children } = familyContext;
    
    const details = [
        `Name: ${getFullName(person)}`,
        person.birthDate && `Born: ${person.birthDate}${person.birthPlace ? ` in ${person.birthPlace}` : ''}`,
        person.deathDate && `Died: ${person.deathDate}${person.deathPlace ? ` in ${person.deathPlace}` : ''}`,
        person.occupation && `Occupation: ${person.occupation}`,
        parents.length > 0 && `Parents: ${parents.map(p => p?.firstName).join(' and ')}`,
        spouses.length > 0 && `Spouse(s): ${spouses.map(s => s?.firstName).join(', ')}`,
        children.length > 0 && `Children: ${children.map(c => c?.firstName).join(', ')}`,
        person.notes && `Notes: ${person.notes}`
    ].filter(Boolean).join('. ');

    const prompt = `
        Generate a short, engaging biographical narrative for the following person, written in a respectful, historical summary style.
        Do not just list the facts, but weave them into a story.
        If dates are available, mention them.
        The story should be about 3-4 paragraphs long.
        
        Person's Details:
        ${details}

        Based on these details, write their life story.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error generating life story with Gemini API:", error);
        return "An error occurred while generating the life story. Please check the console for more details.";
    }
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    if (!text || !targetLanguage) {
        return "Missing text or language for translation.";
    }

    const prompt = `
        Translate the following text to ${targetLanguage}.
        Provide only the translated text, without any additional comments, introductions, or formatting.

        Text to translate:
        """
        ${text}
        """
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error(`Error translating text to ${targetLanguage} with Gemini API:`, error);
        return `An error occurred while translating the text. Please check the console for more details.`;
    }
};

interface PersonForMatching {
    id: string;
    fullName: string;
    birthDate?: string;
    deathDate?: string;
    parentNames?: string[];
}

export const findMatchingPeople = async (tree1People: Person[], tree2People: Person[]): Promise<{person1Id: string, person2Id: string}[]> => {
    
    const simplifyPerson = (p: Person, allPeople: Person[]): PersonForMatching => ({
        id: p.id,
        fullName: getFullName(p),
        birthDate: p.birthDate,
        deathDate: p.deathDate,
        parentNames: p.parentIds?.map(id => getFullName(allPeople.find(parent => parent.id === id))).filter(Boolean) as string[]
    });

    const simplifiedTree1 = tree1People.map(p => simplifyPerson(p, tree1People));
    const simplifiedTree2 = tree2People.map(p => simplifyPerson(p, tree2People));
    
    const prompt = `
        You are an expert genealogist. Your task is to find individuals who are likely the same person across two different family tree datasets.
        
        Analyze the two lists of people provided. Identify pairs of people (one from Tree 1, one from Tree 2) that represent the same individual.
        
        Matching criteria:
        1.  **Name:** Names should be very similar or identical. Consider variations in middle names or spellings.
        2.  **Dates:** Birth and death dates should be identical or very close (within a year or two).
        3.  **Parents:** If parent names are available, they should also match. This is a strong indicator.

        Return a JSON array of objects, where each object contains the IDs of the matched pair.
        
        Tree 1 People:
        ${JSON.stringify(simplifiedTree1, null, 2)}
        
        Tree 2 People:
        ${JSON.stringify(simplifiedTree2, null, 2)}

        Provide only the JSON array.
    `;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            person1Id: {
              type: Type.STRING,
              description: 'The ID of the person from the first tree.',
            },
            person2Id: {
              type: Type.STRING,
              description: 'The ID of the person from the second tree.',
            },
          },
          required: ["person1Id", "person2Id"],
        },
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const jsonString = response.text.trim();
        const matches = JSON.parse(jsonString);
        return matches;

    } catch (error) {
        console.error("Error finding matching people with Gemini API:", error);
        alert("An AI error occurred while trying to find matches. Please check the console and try again, or select matches manually.");
        return [];
    }
};
