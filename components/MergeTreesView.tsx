
import React, { useState } from 'react';
import { useFamilyTreeContext } from '../hooks/useFamilyTree.ts';
import { getFullName } from '../utils/personUtils.ts';
import Select from './ui/Select.tsx';
import SearchableSelect from './ui/SearchableSelect.tsx';
import Button from './ui/Button.tsx';
import { SpinnerIcon, UsersIcon, UserIcon, TrashIcon } from './ui/Icons.tsx';
import Modal from './ui/Modal.tsx';
import { findMatchingPeople } from '../services/geminiService.ts';
import type { Person } from '../types.ts';
import { Gender } from '../types.ts';

const PersonPreviewCard = ({ person, treeName, allPeople }: { person?: Person; treeName: string; allPeople: Person[] }) => {
    if (!person) {
        return (
            <div className="p-4 border rounded-lg h-full flex flex-col items-center justify-center text-center bg-gray-50 dark:bg-gray-800/50">
                <p className="text-gray-500">Select a person from</p>
                <p className="font-semibold">{treeName}</p>
            </div>
        );
    }
    const genderClass = person.gender === Gender.Male ? 'border-male-border bg-male' : person.gender === Gender.Female ? 'border-female-border bg-female' : 'border-gray-500';
    const parents = person.parentIds?.map(id => allPeople.find(p => p.id === id)).filter(Boolean) as Person[] || [];

    return (
        <div className={`p-3 border-2 rounded-lg bg-white dark:bg-gray-900 ${genderClass} h-full`}>
            <div className="flex items-start space-x-3">
                 <div className="flex-shrink-0 w-16 h-20 rounded-md flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    {person.photos?.[0] ? <img src={person.photos[0]} alt={getFullName(person)} className="w-full h-full object-cover" /> : <UserIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />}
                </div>
                <div className="text-sm space-y-1">
                    <p className="font-bold text-base whitespace-normal">{getFullName(person)}</p>
                    <p><span className="font-semibold">Born:</span> {person.birthDate || 'N/A'}{person.birthPlace ? `, ${person.birthPlace}` : ''}</p>
                    {person.deathDate && <p><span className="font-semibold">Died:</span> {person.deathDate}{person.deathPlace ? `, ${person.deathPlace}` : ''}</p>}
                    {parents.length > 0 && <p><span className="font-semibold">Parents:</span> {parents.map(getFullName).join(' & ')}</p>}
                </div>
            </div>
        </div>
    );
};

const MergeTreesView = () => {
    const { trees, mergeTrees } = useFamilyTreeContext();
    const [tree1Id, setTree1Id] = useState('');
    const [tree2Id, setTree2Id] = useState('');
    
    const [manualPerson1Id, setManualPerson1Id] = useState('');
    const [manualPerson2Id, setManualPerson2Id] = useState('');

    const [isMerging, setIsMerging] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [mergedTreeName, setMergedTreeName] = useState('');
    
    const [aiMatches, setAiMatches] = useState<{ person1Id: string; person2Id: string; }[]>([]);
    const [selectedMatches, setSelectedMatches] = useState<{person1Id: string, person2Id: string}[]>([]);
    const [isLoadingAiMatches, setIsLoadingAiMatches] = useState(false);
  
    const treeOptions = Object.values(trees);
    const tree1 = trees[tree1Id];
    const tree2 = trees[tree2Id];

    const resetSelections = () => {
        setManualPerson1Id('');
        setManualPerson2Id('');
        setAiMatches([]);
        setSelectedMatches([]);
    };

    const handleTree1Change = (id: string) => {
        setTree1Id(id);
        resetSelections();
    };

    const handleTree2Change = (id: string) => {
        setTree2Id(id);
        resetSelections();
    };
    
    const handleFindAiMatches = async () => {
        if (!tree1 || !tree2) return;
        setIsLoadingAiMatches(true);
        setAiMatches([]);
        const matches = await findMatchingPeople(tree1.people, tree2.people);
        setAiMatches(matches);
        setIsLoadingAiMatches(false);
    };
    
    const handleToggleMatchSelection = (match: { person1Id: string, person2Id: string }, isChecked: boolean) => {
        setSelectedMatches(prev => {
            const isAlreadySelected = prev.some(m => m.person1Id === match.person1Id && m.person2Id === match.person2Id);
            if (isChecked && !isAlreadySelected) {
                return [...prev, match];
            } else if (!isChecked && isAlreadySelected) {
                return prev.filter(m => m.person1Id !== match.person1Id || m.person2Id !== match.person2Id);
            }
            return prev;
        });
    };

    const handleAddManualPair = () => {
        if (!manualPerson1Id || !manualPerson2Id) return;
        
        const newMatch = { person1Id: manualPerson1Id, person2Id: manualPerson2Id };
        
        const isAlreadySelected = selectedMatches.some(m => m.person1Id === newMatch.person1Id && m.person2Id === newMatch.person2Id);
        if(!isAlreadySelected) {
             setSelectedMatches(prev => [...prev, newMatch]);
        }
        
        setManualPerson1Id('');
        setManualPerson2Id('');
    };
    
    const handleRemoveSelectedPair = (index: number) => {
        setSelectedMatches(prev => prev.filter((_, i) => i !== index));
    };

    const handleMerge = async () => {
        if (!tree1Id || !tree2Id || selectedMatches.length === 0) {
            alert('Please select at least one pair of individuals to merge.');
            return;
        }
        setIsMerging(true);
        const newTree = await mergeTrees(tree1Id, tree2Id, selectedMatches);
        setIsMerging(false);

        if (newTree) {
            setMergedTreeName(newTree.name);
            setIsSuccessModalOpen(true);
            setTree1Id('');
            setTree2Id('');
            resetSelections();
        }
    };
  
    return (
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-6 flex-1 flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Merge Trees</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">Combine two family trees into a new one by identifying common individuals between them.</p>
            
            {treeOptions.length < 2 ? (
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center p-8">
                        <h3 className="text-xl font-semibold">Need Two Trees to Merge</h3>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            You need at least two family trees in your workspace to use this feature.
                        </p>
                        <div className="mt-4 inline-block">
                            <UsersIcon className="w-10 h-10 text-gray-400" />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col space-y-6">
                    {/* Step 1: Select Trees */}
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="font-semibold text-lg mb-2">Step 1: Select Two Trees to Compare</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Select label="Family One" value={tree1Id} onChange={e => handleTree1Change(e.target.value)}>
                                <option value="">-- Select Tree --</option>
                                {treeOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                            <Select label="Family Two" value={tree2Id} onChange={e => handleTree2Change(e.target.value)}>
                                <option value="">-- Select Tree --</option>
                                {treeOptions.filter(t => t.id !== tree1Id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                        </div>
                    </div>

                    {/* Step 2: Find Matches */}
                    {tree1 && tree2 && (
                        <div className="p-4 border rounded-lg animate-fadeIn">
                             <h3 className="font-semibold text-lg mb-2">Step 2: Find Common People</h3>
                             <div className="flex flex-col md:flex-row gap-4">
                                <div className="md:w-1/2 p-4 border-r border-gray-200 dark:border-gray-700 pr-4">
                                    <h4 className="font-semibold mb-2">Option A: Find Matches with AI</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Let AI suggest potential matches. Select the pairs you want to merge.</p>
                                    <Button onClick={handleFindAiMatches} disabled={isLoadingAiMatches}>
                                        {isLoadingAiMatches && <SpinnerIcon />}
                                        <span className="ml-2">{isLoadingAiMatches ? 'Searching...' : 'Find AI Matches'}</span>
                                    </Button>
                                    {isLoadingAiMatches && <p className="text-sm text-blue-500 mt-2">AI is analyzing both trees... this may take a moment.</p>}
                                    {aiMatches.length > 0 && (
                                        <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
                                            <h5 className="font-bold">{aiMatches.length} match(es) found:</h5>
                                            {aiMatches.map((match, index) => {
                                                const p1 = tree1.people.find(p => p.id === match.person1Id);
                                                if (!p1) return null;
                                                const isSelected = selectedMatches.some(m => m.person1Id === match.person1Id && m.person2Id === match.person2Id);
                                                return (
                                                    <label key={index} className="flex items-center space-x-3 p-2 rounded-lg border-2 bg-white dark:bg-gray-800/50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/50">
                                                        <input type="checkbox" checked={isSelected} onChange={e => handleToggleMatchSelection(match, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                                        <div>
                                                            <p className="font-semibold">{getFullName(p1)}</p>
                                                            <p className="text-xs">Born: {p1.birthDate || 'N/A'}</p>
                                                        </div>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="md:w-1/2 p-4">
                                    <h4 className="font-semibold mb-2">Option B: Add a Pair Manually</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">If you know who to merge, select and add them to the list.</p>
                                    <div className="space-y-4">
                                        <SearchableSelect label={`Person from "${tree1.name}"`} options={tree1.people} value={manualPerson1Id} onChange={setManualPerson1Id} placeholder="Select person" />
                                        <SearchableSelect label={`Person from "${tree2.name}"`} options={tree2.people} value={manualPerson2Id} onChange={setManualPerson2Id} placeholder="Select person" />
                                    </div>
                                    <div className="mt-3">
                                        <Button variant="secondary" onClick={handleAddManualPair} disabled={!manualPerson1Id || !manualPerson2Id}>Add Pair to Merge List</Button>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                    
                    {/* Step 3: Confirm and Merge */}
                    {selectedMatches.length > 0 && tree1 && tree2 && (
                         <div className="p-4 border rounded-lg animate-fadeIn">
                             <h3 className="font-semibold text-lg mb-2">Step 3: Confirm Selections & Merge</h3>
                             <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Review the pairs you've selected. These individuals will be merged into single entries in the new tree.</p>
                             <div className="space-y-3 max-h-80 overflow-y-auto mb-4 pr-2">
                                {selectedMatches.map((match, index) => {
                                    const p1 = tree1.people.find(p => p.id === match.person1Id);
                                    const p2 = tree2.people.find(p => p.id === match.person2Id);
                                    if(!p1 || !p2) return null;

                                    return (
                                        <div key={index} className="flex items-center space-x-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                            <div className="flex-1"><PersonPreviewCard person={p1} treeName={tree1.name} allPeople={tree1.people} /></div>
                                            <div className="font-bold text-lg text-gray-500">&harr;</div>
                                            <div className="flex-1"><PersonPreviewCard person={p2} treeName={tree2.name} allPeople={tree2.people} /></div>
                                            <Button size="sm" variant="danger" onClick={() => handleRemoveSelectedPair(index)} className="self-center">
                                                <TrashIcon />
                                            </Button>
                                        </div>
                                    )
                                })}
                             </div>
                             <div className="flex justify-end">
                                <Button onClick={handleMerge} disabled={isMerging} size="md">
                                    {isMerging && <SpinnerIcon />}
                                    <span className="ml-2">{isMerging ? 'Merging...' : `Merge ${selectedMatches.length} Pair(s)`}</span>
                                </Button>
                            </div>
                         </div>
                    )}

                    <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} title="Merge Successful">
                        <div className="space-y-4">
                            <p>The two trees have been successfully combined into a new tree: <strong>{mergedTreeName}</strong>.</p>
                            <p>You are now working on this new merged tree.</p>
                            <div className="flex justify-end pt-2">
                                <Button onClick={() => setIsSuccessModalOpen(false)}>Continue</Button>
                            </div>
                        </div>
                    </Modal>
                </div>
            )}
        </div>
    );
};

export default MergeTreesView;
