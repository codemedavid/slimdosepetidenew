import React from 'react';
import { useCategories } from '../hooks/useCategories';

interface SubNavProps {
  selectedCategory: string;
  onCategoryClick: (categoryId: string) => void;
}

const SubNav: React.FC<SubNavProps> = ({ selectedCategory, onCategoryClick }) => {
  const { categories, loading } = useCategories();

  if (loading) {
    return (
      <div className="bg-white">
        <div className="container mx-auto px-4 py-3">
          <div className="flex space-x-3 overflow-x-auto scrollbar-hide">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse bg-cream-100 h-11 w-36 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <nav className="bg-white sticky top-[64px] md:top-[80px] lg:top-[88px] z-40">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-3 py-3 overflow-x-auto scrollbar-hide">
          {categories.map((category) => {
            const isSelected = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => onCategoryClick(category.id)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5"
                style={
                  isSelected
                    ? {
                        backgroundColor: '#3C6CA8',
                        color: '#FFFFFF',
                        border: '1.5px solid #3C6CA8',
                        boxShadow: '0 4px 12px rgba(60, 108, 168, 0.25)',
                      }
                    : {
                        backgroundColor: '#FFFFFF',
                        color: '#3C6CA8',
                        border: '1.5px solid #C2D4EA',
                        boxShadow: '0 1px 2px rgba(60, 108, 168, 0.04)',
                      }
                }
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </nav>
  );
};

export default SubNav;
