import React from 'react';
import { LucideIcon, X } from 'lucide-react';
import { useTheme } from './ThemeContext';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon: Icon,
  ...props
}) => {
  const { isDark } = useTheme();
  const baseStyle = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-md",
    secondary: "bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 shadow-sm",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-5 py-2.5 text-base gap-2",
    lg: "px-7 py-3.5 text-lg gap-2.5",
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5" />}
      {children}
    </button>
  );
};

// --- Card ---
interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action }) => {
  return (
    <div className={`bg-white shadow-md dark:bg-gray-800 dark:shadow-none rounded-xl p-6 transition-all duration-200 text-gray-900 dark:text-gray-100 ${className}`}>
      {(title || action) && (
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
          {title && <h3 className="text-xl font-semibold">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  endIcon?: LucideIcon;
  onEndIconClick?: () => void;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', icon: Icon, endIcon: EndIcon, onEndIconClick, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">{label}</label>}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
            <Icon size={18} />
          </div>
        )}
        <input
          className={`w-full rounded-lg py-2.5 transition-shadow outline-none border
            bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:focus:ring-blue-400 dark:placeholder-gray-400
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-500' : ''}
            ${Icon ? 'pl-10' : 'px-4'} ${EndIcon ? 'pr-10' : 'px-4'}
            ${className}`}
          {...props}
        />
        {EndIcon && (
          <button
            type="button"
            onClick={onEndIconClick}
            className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${onEndIconClick ? 'cursor-pointer' : 'pointer-events-none'} text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300`}
          >
            <EndIcon size={18} />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
};

// --- Badge ---
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral' }) => {
  const styles = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
};

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-2xl w-full max-w-2xl shadow-xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
