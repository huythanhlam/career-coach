import React from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface ResumeRendererProps {
  markdownContent: string;
  templateType: string;
  customComponents?: any;
}

export function ResumeRenderer({ markdownContent, templateType, customComponents = {} }: ResumeRendererProps) {
  // Base styling for all templates to reset prose defaults where needed
  const getThemeClasses = () => {
    switch (templateType) {
      case "Modern & Clean":
        return "prose prose-zinc max-w-none text-zinc-800 dark:text-zinc-200 w-full prose-h1:text-4xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:text-zinc-900 prose-h1:mb-2 prose-h2:text-xl prose-h2:font-semibold prose-h2:border-b-2 prose-h2:border-zinc-200 prose-h2:pb-1 prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:font-medium prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-0";
      
      case "Tech Focused":
        return "prose prose-slate max-w-none text-slate-700 dark:text-slate-300 w-full prose-h1:text-3xl prose-h1:font-bold prose-h1:font-mono prose-h1:uppercase prose-h1:tracking-tight prose-h1:text-indigo-600 prose-h2:text-lg prose-h2:font-bold prose-h2:font-mono prose-h2:uppercase prose-h2:border-b prose-h2:border-slate-300 prose-h2:pb-1 prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-base prose-h3:font-bold prose-h3:mt-3 prose-h3:mb-1 prose-h3:text-indigo-800 prose-p:my-1 prose-ul:my-2 prose-li:my-0 prose-a:text-indigo-600";
        
      case "Executive":
        return "prose prose-stone max-w-none text-stone-900 dark:text-stone-100 w-full font-serif prose-h1:text-4xl prose-h1:font-normal prose-h1:text-center prose-h1:mb-2 prose-h2:text-lg prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-center prose-h2:border-b-2 prose-h2:border-stone-800 dark:prose-h2:border-stone-200 prose-h2:pb-2 prose-h2:mt-6 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-bold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-0";
        
      case "Creative / Portfolio":
        return "prose prose-pink max-w-none text-zinc-800 dark:text-zinc-200 w-full prose-h1:text-5xl prose-h1:font-black prose-h1:tracking-tighter prose-h1:text-transparent prose-h1:bg-clip-text prose-h1:bg-gradient-to-r prose-h1:from-pink-500 prose-h1:to-violet-500 prose-h1:mb-3 prose-h2:text-2xl prose-h2:font-bold prose-h2:text-pink-600 prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-1 prose-li:marker:text-pink-500";
        
      case "Photography / Visual":
        return "prose prose-neutral max-w-none text-neutral-800 dark:text-neutral-200 w-full prose-h1:text-3xl prose-h1:font-light prose-h1:uppercase prose-h1:tracking-[0.2em] prose-h1:text-center prose-h1:mb-4 prose-h2:text-xl prose-h2:font-medium prose-h2:uppercase prose-h2:tracking-widest prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-2 prose-p:font-light prose-p:leading-relaxed prose-ul:my-2 prose-li:my-1";

      case "Academic / Research":
        return "prose prose-zinc max-w-none text-zinc-900 dark:text-zinc-100 w-full prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-2 prose-h2:text-lg prose-h2:font-bold prose-h2:bg-zinc-100 dark:prose-h2:bg-zinc-800 prose-h2:px-2 prose-h2:py-1 prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:font-bold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-1 prose-li:marker:text-zinc-400";
        
      default:
        return "prose prose-zinc max-w-none";
    }
  };

  return (
    <div className={getThemeClasses()}>
      <Markdown 
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom renderers to ensure bullet points are clean
          ul: ({node, ...props}) => <ul className="list-disc pl-5" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5" {...props} />,
          // For Executive template, we un-center standard paragraphs that might be list bodies
          // We apply text-center only to contact info directly after h1, in CSS above it centered everything.
          // Let's refine it with a custom p renderer:
          p: ({node, ...props}) => {
             // If we are in Executive template, we might want only the first P to be centered (contact info)
             // We'll let CSS handle it simply, but override prose defaults
             return <p {...props} />;
          },
          ...customComponents
        }}
      >
        {markdownContent}
      </Markdown>
    </div>
  );
}
