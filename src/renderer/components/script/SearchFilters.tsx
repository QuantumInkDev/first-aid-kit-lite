import React from 'react';
import { cn } from '@/lib/utils';

export interface SearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedRiskLevel: string;
  onRiskLevelChange: (riskLevel: string) => void;
  categories: string[];
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedRiskLevel,
  onRiskLevelChange,
  categories,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              'block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'text-sm placeholder-gray-400'
            )}
          />
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={cn(
              'block w-full px-3 py-2 border border-gray-300 rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'text-sm bg-white'
            )}
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Risk Level Filter */}
        <div>
          <select
            value={selectedRiskLevel}
            onChange={(e) => onRiskLevelChange(e.target.value)}
            className={cn(
              'block w-full px-3 py-2 border border-gray-300 rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'text-sm bg-white'
            )}
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      {(searchQuery || selectedCategory || selectedRiskLevel) && (
        <div className="mt-4 flex items-center flex-wrap gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
              Search: "{searchQuery}"
              <button
                onClick={() => onSearchChange('')}
                className="ml-2 hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
          {selectedCategory && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
              Category: {selectedCategory}
              <button
                onClick={() => onCategoryChange('')}
                className="ml-2 hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
          {selectedRiskLevel && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
              Risk: {selectedRiskLevel}
              <button
                onClick={() => onRiskLevelChange('')}
                className="ml-2 hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
          <button
            onClick={() => {
              onSearchChange('');
              onCategoryChange('');
              onRiskLevelChange('');
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
