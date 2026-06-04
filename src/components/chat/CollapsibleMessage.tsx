import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MarkdownText } from '../MarkdownText';

export const CollapsibleMessage = ({ text }: { text: string }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > 250);
    }
  }, [text]);

  return (
    <div className="relative">
      <div 
        ref={contentRef}
        className={`overflow-hidden transition-all duration-300 ${collapsed && isOverflowing ? 'max-h-[250px]' : 'max-h-[5000px]'}`}
      >
        <MarkdownText text={text} />
      </div>
      
      {isOverflowing && (
        <div className={`flex justify-center mt-2 ${collapsed ? 'absolute bottom-0 left-0 right-0 pt-12 pb-2 bg-gradient-to-t from-bg-app/95 to-transparent' : ''}`}>
          <button 
            type="button" 
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1 py-1 px-3 bg-bg-surface hover:bg-accent-primary/80 text-text-main hover:text-text-bright text-[10px] font-mono font-bold uppercase rounded-full border border-border-subtle hover:border-accent-primary transition-all cursor-pointer shadow-lg backdrop-blur-md"
          >
            {collapsed ? (
              <><ChevronDown size={12} /> Show More</>
            ) : (
              <><ChevronUp size={12} /> Show Less</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
