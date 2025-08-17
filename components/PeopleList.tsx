
import React, { useState, useMemo } from 'react';
import type { Person } from '../types.ts';
import { Gender } from '../types.ts';
import { useFamilyTreeContext } from '../hooks/useFamilyTree.ts';
import { calculateAge } from '../utils/dateUtils.ts';
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, UserIcon } from './ui/Icons.tsx';
import Button from './ui/Button.tsx';
import Modal from './ui/Modal.tsx';
import { getFullName } from '../utils/personUtils.ts';

type SortKey = 'firstName' | 'birthDate' | 'deathDate';
type SortDirection = 'asc' | 'desc';

interface PeopleListProps {
  openPersonForm: (person?: Person, template?: Partial<Person>) => void;
}

const PeopleList: React.FC<PeopleListProps> = ({ openPersonForm }) => {
    const { people, deletePerson } = useFamilyTreeContext();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'firstName', direction: 'asc' });

    const handleAdd = () => {
        openPersonForm(undefined);
    };

    const handleEdit = (person: Person) => {
        openPersonForm(person);
    };

    const handleDelete = (person: Person) => {
        setPersonToDelete(person);
        setIsDeleteModalOpen(true);
    };
    
    const confirmDelete = () => {
        if (personToDelete) {
            deletePerson(personToDelete.id);
            setIsDeleteModalOpen(false);
            setPersonToDelete(null);
        }
    };
    
    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredPeople = useMemo(() => {
        let sortableItems = [...people];
        if (searchTerm) {
            sortableItems = sortableItems.filter(p =>
                getFullName(p).toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        sortableItems.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];

            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            
            if (valA < valB) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sortableItems;
    }, [people, searchTerm, sortConfig]);
    
    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />;
    };
    
    const SortableHeader = ({ sortKey, children }: { sortKey: SortKey, children: React.ReactNode}) => (
         <div className="flex items-center space-x-1 cursor-pointer" onClick={() => requestSort(sortKey)}>
            <span>{children}</span>
            {getSortIcon(sortKey)}
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-4 sm:p-6 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">All Individuals ({people.length})</h2>
                <Button onClick={handleAdd}>
                    <PlusIcon /> <span className="ml-2 hidden sm:inline">Add Person</span>
                </Button>
            </div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
            <div className="flex-grow overflow-auto">
                 {/* Table Header for medium screens and up */}
                <div className="hidden md:grid grid-cols-[60px,50px,1fr,1fr,1fr,1fr,auto] gap-4 p-3 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
                    <div className="text-left">Photo</div>
                    <div className="text-center">Status</div>
                    <SortableHeader sortKey="firstName">Name</SortableHeader>
                    <SortableHeader sortKey="birthDate">Born</SortableHeader>
                    <SortableHeader sortKey="deathDate">Died</SortableHeader>
                    <div>Age</div>
                    <div>Actions</div>
                </div>

                {/* List of People */}
                <div className="space-y-4 md:space-y-0">
                    {sortedAndFilteredPeople.map(person => {
                        const genderClass = person.gender === Gender.Male 
                            ? 'bg-male dark:bg-male-dark border-male-border' 
                            : person.gender === Gender.Female 
                            ? 'bg-female dark:bg-female-dark border-female-border'
                            : 'border-gray-500';

                         let statusDot;
                         if (person.deathDate) {
                             statusDot = <div className="w-3 h-3 bg-red-500 rounded-full" title="Deceased"></div>;
                         } else if (person.birthDate) {
                             statusDot = <div className="w-3 h-3 bg-green-500 rounded-full" title="Alive"></div>;
                         } else {
                             statusDot = <div className="w-3 h-3 bg-gray-400 rounded-full" title="Unknown Status"></div>;
                         }

                        return (
                            <div key={person.id} className={`p-4 bg-white dark:bg-gray-800/50 rounded-lg shadow md:shadow-none md:bg-transparent md:p-0 md:rounded-none md:border-b md:dark:border-gray-700 ${genderClass} md:border-l-4`}>
                                <div className="md:grid md:grid-cols-[60px,50px,1fr,1fr,1fr,1fr,auto] md:items-center md:gap-x-4">
                                    {/* --- Col 1: Photo & Mobile Main Info --- */}
                                    <div className="flex items-center space-x-4 col-span-1">
                                        <div className="w-12 h-12 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 overflow-hidden border-2 border-gray-300">
                                            {person.photos?.[0] ? 
                                                <img src={person.photos[0]} alt={getFullName(person)} className="w-full h-full object-cover" /> : 
                                                <UserIcon className="w-6 h-6 text-gray-400" />
                                            }
                                        </div>
                                        <div className="md:hidden flex-grow">
                                            <div className="flex items-center space-x-2">
                                                 {statusDot}
                                                 <div 
                                                    className="font-bold text-lg cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                    onClick={() => handleEdit(person)}
                                                >
                                                    {getFullName(person)}
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">{person.gender}</div>
                                        </div>
                                    </div>
                                    
                                    {/* --- Desktop-only columns --- */}
                                    <div className="hidden md:flex justify-center items-center">{statusDot}</div>
                                    <div 
                                        className="hidden md:block font-medium cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                        onClick={() => handleEdit(person)}
                                    >{getFullName(person)}</div>
                                    
                                    {/* --- Data for both mobile and desktop --- */}
                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 md:border-none md:pt-0 md:mt-0 space-y-2 md:contents text-sm">
                                        <div className="flex justify-between md:block"><span className="font-semibold text-gray-600 dark:text-gray-400 md:hidden">Born</span> <span className="text-right md:text-left">{person.birthDate || 'N/A'}</span></div>
                                        <div className="flex justify-between md:block"><span className="font-semibold text-gray-600 dark:text-gray-400 md:hidden">Died</span> <span className="text-right md:text-left">{person.deathDate || 'N/A'}</span></div>
                                        <div className="flex justify-between md:block"><span className="font-semibold text-gray-600 dark:text-gray-400 md:hidden">Age</span> <span className="text-right md:text-left">{calculateAge(person.birthDate, person.deathDate)}</span></div>
                                    </div>
                                    
                                    {/* --- Actions --- */}
                                    <div className="mt-4 pt-4 border-t md:border-none md:pt-0 md:mt-0 flex justify-end md:justify-start">
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleEdit(person)} className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"><PencilIcon /></button>
                                            <button onClick={() => handleDelete(person)} className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"><TrashIcon /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
                <div className="space-y-4">
                    <p>Are you sure you want to delete <strong>{getFullName(personToDelete)}</strong>? This will remove them from the tree and all associated relationships. This action cannot be undone.</p>
                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete}>Delete Person</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PeopleList;
