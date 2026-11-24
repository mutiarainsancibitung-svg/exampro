import React from 'react';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow transition-shadow duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
