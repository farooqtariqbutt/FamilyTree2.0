
import React, { useState, useMemo } from 'react';
import { useFamilyTreeContext } from '../hooks/useFamilyTree.ts';
import { getFullName } from '../utils/personUtils.ts';
import Select from './ui/Select.tsx';
import Button from './ui/Button.tsx';
import { SpinnerIcon, UsersIcon, UserIcon } from './ui/Icons.tsx';
import Modal from './ui/Modal.tsx';
import type { Person } from '../types.ts';

const SplitTreeView = () => {
    const { trees, splitTree } = useFamilyTreeContext();
    const [sourceTreeId, setSourceTreeId] = useState('');
    const [selectedRootIds, setSelectedRootIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const [isSplitting, setIsSplitting] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [newTreeCount, setNewTreeCount] = useState(0);

    const treeOptions = Object.values(trees);
    const sourceTree = trees[sourceTreeId];

    const handleSourceTreeChange = (id: string) => {
        setSourceTreeId(id);
        setSelectedRootIds(new Set());
        setSearchTerm('');
    };

    const handleTogglePerson = (personId: string) => {
        setSelectedRootIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(personId)) {
                newSet.delete(personId);
            } else {
                newSet.add(personId);
            }
            return newSet;
        });
    };

    const handleSplit = async () => {
        if (!sourceTreeId || selectedRootIds.size === 0) {
            alert('Please select a source tree and at least one person to start a new lineage.');
            return;
        }
        setIsSplitting(true);
        const newIds = await splitTree(sourceTreeId, Array.from(selectedRootIds));
        setIsSplitting(false);

        if (newIds.length > 0) {
            setNewTreeCount(newIds.length);
            setIsSuccessModalOpen(true);
            setSourceTreeId('');
            setSelectedRootIds(new Set());
        }
    };
    
    const filteredPeople = useMemo(() => {
        if (!sourceTree) return [];
        if (!searchTerm) return sourceTree.people;
        return sourceTree.people.filter(p =>
            getFullName(p).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sourceTree, searchTerm]);

    return (
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-6 flex-1 flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Split Tree</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">Create new, smaller trees from an existing one by selecting individuals to start new descendant lines. The original tree will not be changed.</p>
            
            {treeOptions.length < 1 ? (
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center p-8">
                        <h3 className="text-xl font-semibold">No Trees to Split</h3>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Create a family tree first before using this feature.
                        </p>
                        <div className="mt-4 inline-block">
                            <UsersIcon className="w-10 h-10 text-gray-400" />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col space-y-6">
                    {/* Step 1: Select Tree */}
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="font-semibold text-lg mb-2">Step 1: Select a Tree to Split</h3>
                        <Select label="Source Tree" value={sourceTreeId} onChange={e => handleSourceTreeChange(e.target.value)}>
                            <option value="">-- Select Tree --</option>
                            {treeOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>

                    {/* Step 2: Select Roots */}
                    {sourceTree && (
                        <div className="p-4 border rounded-lg animate-fadeIn flex-grow flex flex-col">
                            <h3 className="font-semibold text-lg mb-2">Step 2: Select People to Start New Trees</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                For each person you select, a new tree will be created containing them and all of their descendants.
                            </p>
                            <input
                                type="text"
                                placeholder="Search for a person..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 mb-4"
                            />
                            <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                                {filteredPeople.map(person => (
                                     <label key={person.id} className="flex items-center space-x-3 p-2 rounded-lg border-2 bg-white dark:bg-gray-800/50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedRootIds.has(person.id)}
                                            onChange={() => handleTogglePerson(person.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                           {person.photos?.[0] ? <img src={person.photos[0]} alt={getFullName(person)} className="w-full h-full object-cover" /> : <UserIcon />}
                                        </div>
                                        <div>
                                            <p className="font-semibold">{getFullName(person)}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Born: {person.birthDate || 'N/A'}</p>
                                        </div>
                                    </label>
                                ))}
                                {filteredPeople.length === 0 && <p className="text-center text-gray-500 p-4">No people found matching your search.</p>}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {selectedRootIds.size > 0 && (
                         <div className="p-4 border rounded-lg animate-fadeIn">
                            <h3 className="font-semibold text-lg mb-2">Step 3: Confirm and Split</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">You are about to create <span className="font-bold">{selectedRootIds.size}</span> new tree(s). The original tree, "{sourceTree?.name}", will not be modified.</p>
                            <div className="flex justify-end">
                                <Button onClick={handleSplit} disabled={isSplitting}>
                                    {isSplitting && <SpinnerIcon />}
                                    <span className="ml-2">{isSplitting ? 'Splitting...' : `Create ${selectedRootIds.size} New Tree(s)`}</span>
                                </Button>
                            </div>
                         </div>
                    )}
                </div>
            )}
            
             <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} title="Split Successful">
                <div className="space-y-4">
                    <p>Successfully created <strong>{newTreeCount}</strong> new tree(s).</p>
                    <p>You have been automatically switched to the first new tree. You can switch between all your trees using the dropdown in the header.</p>
                    <div className="flex justify-end pt-2">
                        <Button onClick={() => setIsSuccessModalOpen(false)}>Continue</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SplitTreeView;
