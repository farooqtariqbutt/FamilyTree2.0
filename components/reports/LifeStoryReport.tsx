
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFamilyTreeContext } from '../../hooks/useFamilyTree.ts';
import { generateLifeStory, translateText } from '../../services/geminiService.ts';
import Button from '../ui/Button.tsx';
import { PrintIcon, SpinnerIcon } from '../ui/Icons.tsx';
import { generatePdf } from '../../utils/pdfUtils.ts';
import SearchableSelect from '../ui/SearchableSelect.tsx';
import { getFullName } from '../../utils/personUtils.ts';
import { Gender } from '../../types.ts';

const LifeStoryReport = () => {
    const { people, getPersonById } = useFamilyTreeContext();
    const [personId, setPersonId] = useState('');
    const [story, setStory] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState('Urdu');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const lifeStoryReportRef = useRef<HTMLDivElement>(null);

    const handleGenerate = useCallback(async () => {
        if (!personId) return;
        const person = people.find(p => p.id === personId);
        if (!person) return;

        setIsLoading(true);
        setStory('');

        const parents = person.parentIds?.map(id => getPersonById(id)).filter(p => p) || [];
        const spouses = person.marriages?.map(m => getPersonById(m.spouseId)).filter(p => p) || [];
        const children = person.childrenIds?.map(id => getPersonById(id)).filter(p => p) || [];

        const lifeStory = await generateLifeStory(person, { parents, spouses, children });
        setStory(lifeStory);
        setIsLoading(false);
    }, [personId, people, getPersonById]);

    useEffect(() => {
        if (personId) {
            handleGenerate();
        } else {
            setStory('');
        }
    }, [personId, handleGenerate]);
    
    const handleTranslate = async () => {
        if (!story || !targetLanguage) return;
        setIsTranslating(true);
        const translatedStory = await translateText(story, targetLanguage);
        setStory(translatedStory);
        setIsTranslating(false);
    };

    const handleDownloadLifeStoryReport = async () => {
        if (!lifeStoryReportRef.current || !selectedPerson) return;
    
        setIsGeneratingPdf(true);
        const fileName = `Life_Story_for_${getFullName(selectedPerson)}`;
        
        const printableElement = document.createElement('div');
        printableElement.style.position = 'absolute';
        printableElement.style.left = '-9999px';
        printableElement.style.width = '210mm';
        printableElement.style.padding = '20px';
        printableElement.style.backgroundColor = 'white';
        printableElement.style.color = 'black';
        printableElement.style.fontFamily = 'sans-serif';

        const reportTitle = `<h1 style="font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 20px;">Life Story Report</h1>`;
        printableElement.innerHTML = reportTitle;
    
        const contentClone = lifeStoryReportRef.current.cloneNode(true) as HTMLElement;
        contentClone.querySelectorAll('.no-print').forEach(el => {
            (el as HTMLElement).style.display = 'none';
        });
        printableElement.appendChild(contentClone);

        document.body.appendChild(printableElement);

        try {
            await generatePdf(printableElement, fileName, 'p');
        } catch (error) {
            console.error("Error generating life story PDF:", error);
            alert("Sorry, an error occurred while generating the PDF report.");
        } finally {
            if (document.body.contains(printableElement)) {
                document.body.removeChild(printableElement);
            }
            setIsGeneratingPdf(false);
        }
    };

    const selectedPerson = people.find(p => p.id === personId);

    return (
        <div className="report-container">
            <h3 className="text-xl font-semibold mb-4">AI-Powered Life Story Generator</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select a person and let our AI assistant craft a biographical narrative based on their recorded life events.
            </p>
            <div className="flex items-end space-x-2 mb-4">
                <div className="flex-grow max-w-sm">
                    <SearchableSelect
                        label="Select Person"
                        options={people}
                        value={personId}
                        onChange={setPersonId}
                        placeholder="Select a person to generate a story"
                    />
                </div>
                {story && (
                    <Button onClick={handleDownloadLifeStoryReport} disabled={isGeneratingPdf} variant="secondary">
                        {isGeneratingPdf ? <SpinnerIcon /> : <PrintIcon />}
                        <span className="ml-2 hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download Report'}</span>
                    </Button>
                )}
            </div>

            <div ref={lifeStoryReportRef}>
                {(isLoading || story) && selectedPerson && (
                     <div className={`p-4 border rounded-lg animate-fadeIn ${
                        selectedPerson.gender === Gender.Male ? 'bg-male dark:bg-male-dark' :
                        selectedPerson.gender === Gender.Female ? 'bg-female dark:bg-female-dark' :
                        'bg-gray-50 dark:bg-gray-800/50'
                     }`}>
                        <div className="flex items-center space-x-4 pb-4 mb-4 border-b border-gray-200 dark:border-gray-700">
                           {selectedPerson.photos?.[0] && <img src={selectedPerson.photos[0]} alt={getFullName(selectedPerson)} className="w-16 h-20 rounded-md object-cover" />}
                           <div>
                             <h4 className="text-lg font-bold">Life Story for {getFullName(selectedPerson)}</h4>
                             <p className="text-sm text-gray-500">{selectedPerson.birthDate} - {selectedPerson.deathDate || 'Present'}</p>
                           </div>
                        </div>
                        {isLoading && (
                            <div className="flex items-center space-x-2 text-gray-500">
                                <SpinnerIcon /> <span>Generating narrative, please wait...</span>
                            </div>
                        )}
                        {story && (
                            <div>
                                <p className="whitespace-pre-wrap leading-relaxed">{story}</p>
                                 <div className="flex items-end space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 no-print">
                                     <div className="flex-grow max-w-xs">
                                         <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Translate to:</label>
                                         <select id="language" value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                                            <option>Urdu</option>
                                            <option>English</option>
                                            <option>Spanish</option>
                                            <option>French</option>
                                            <option>German</option>
                                            <option>Arabic</option>
                                         </select>
                                     </div>
                                    <Button onClick={handleTranslate} disabled={isTranslating || !targetLanguage}>
                                        {isTranslating ? <SpinnerIcon /> : null}
                                        <span className="ml-2">{isTranslating ? 'Translating...' : 'Translate'}</span>
                                    </Button>
                                 </div>
                            </div>
                        )}
                     </div>
                )}
            </div>
        </div>
    );
};

export default LifeStoryReport;
