import React from 'react';
import Modal from './ui/Modal.tsx';
import type { Person } from '../types.ts';
import type { Relationship } from '../utils/relationshipUtils.ts';
import { getFullName } from '../utils/personUtils.ts';
import { UserIcon } from './ui/Icons.tsx';
import { Gender } from '../types.ts';

const PathNode = ({ person, isLCA }: { person: Person; isLCA?: boolean }) => {
    const genderClass = person.gender === Gender.Male
        ? 'border-male-border bg-male dark:bg-male-dark text-gray-800 dark:text-gray-100'
        : 'border-female-border bg-female dark:bg-female-dark text-gray-800 dark:text-gray-100';
    const lcaClass = isLCA ? 'ring-4 ring-yellow-400 dark:ring-yellow-500' : '';
    return (
        <div className="flex flex-col items-center text-center">
            <div className={`p-1.5 border-2 rounded-lg shadow-sm ${genderClass} ${lcaClass}`}>
                <div className="text-xs font-semibold">{getFullName(person)}</div>
            </div>
            {isLCA && <div className="text-xs font-bold text-yellow-500 dark:text-yellow-400 mt-1">Common Ancestor</div>}
        </div>
    );
};

const PersonSummaryCard = ({ person }: { person: Person }) => {
    const genderClass = person.gender === Gender.Male
        ? 'border-male-border bg-male dark:bg-male-dark'
        : person.gender === Gender.Female
        ? 'border-female-border bg-female dark:bg-female-dark'
        : 'border-gray-500 bg-gray-100 dark:bg-gray-800';

    return (
        <div className={`p-3 rounded-lg border-2 ${genderClass} flex items-center space-x-3`}>
            <div className="flex-shrink-0 w-12 h-16 rounded-md flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden">
                {person.photos?.[0] ? <img src={person.photos[0]} alt={`${person.firstName}`} className="w-full h-full object-cover" /> : <UserIcon />}
            </div>
            <div className="text-sm">
                <h3 className="font-bold">{getFullName(person)}</h3>
                <p>Born: {person.birthDate || 'Unknown'}</p>
            </div>
        </div>
    );
};

interface RelationshipPathModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: { person1: Person, person2: Person, relationships: Relationship[] } | null;
}

const RelationshipPathModal: React.FC<RelationshipPathModalProps> = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const { person1, person2, relationships } = data;

    const renderPath = (path: Person[], lca?: Person) => (
        <div className="flex items-center flex-wrap gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {path.map((p, index) => (
                <React.Fragment key={p.id}>
                    <PathNode person={p} isLCA={p.id === lca?.id} />
                    {index < path.length - 1 && <span className="font-bold text-gray-400 text-lg">→</span>}
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relationship Path">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PersonSummaryCard person={person1} />
                    <PersonSummaryCard person={person2} />
                </div>
                
                 <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {relationships.map((relationship, index) => (
                        <div key={index} className="p-4 border-2 rounded-lg bg-white dark:bg-gray-900/50">
                            {relationship.type === 'none' ? (
                                <p className="text-center text-gray-500 italic">{relationship.description}</p>
                            ) : (
                                <>
                                    <div className="text-center p-3 mb-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="font-semibold text-blue-800 dark:text-blue-200">{getFullName(person2)} is the</p>
                                        <p className="text-xl font-bold text-blue-600 dark:text-blue-300">{relationship.description}</p>
                                        <p className="font-semibold text-blue-800 dark:text-blue-200">of {getFullName(person1)}</p>
                                    </div>

                                    {relationship.type === 'blood' && (
                                        <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                                             <p className="mb-2">The closest common ancestor is <strong>{getFullName(relationship.lca)}</strong>.</p>
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <h5 className="font-semibold">Path from {getFullName(person1)}:</h5>
                                                    {renderPath(relationship.path1, relationship.lca)}
                                                </div>
                                                <div>
                                                    <h5 className="font-semibold">Path from {getFullName(person2)}:</h5>
                                                    {renderPath(relationship.path2, relationship.lca)}
                                                </div>
                                             </div>
                                        </div>
                                    )}
                                     {relationship.type === 'path' && relationship.path.length > 2 && (
                                         <div className="space-y-3 mt-4 text-sm text-gray-600 dark:text-gray-300">
                                            <div>
                                                <h4 className="font-semibold mb-1">Full connection path:</h4>
                                                {renderPath(relationship.path)}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default RelationshipPathModal;