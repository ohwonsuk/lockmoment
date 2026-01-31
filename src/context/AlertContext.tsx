import React, { createContext, useContext, useState, useCallback } from 'react';
import { CustomAlert } from '../components/CustomAlert';

interface AlertOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    type?: 'warning' | 'info' | 'error' | 'success';
}

interface AlertContextType {
    showAlert: (options: AlertOptions) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [options, setOptions] = useState<AlertOptions>({ title: '', message: '' });

    const showAlert = useCallback((newOptions: AlertOptions) => {
        setOptions(newOptions);
        setVisible(true);
    }, []);

    const hideAlert = useCallback(() => {
        setVisible(false);
    }, []);

    const handleConfirm = () => {
        hideAlert();
        if (options.onConfirm) options.onConfirm();
    };

    const handleCancel = () => {
        hideAlert();
        if (options.onCancel) options.onCancel();
    };

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <CustomAlert
                isVisible={visible}
                title={options.title}
                message={options.message}
                confirmText={options.confirmText}
                cancelText={options.cancelText}
                onConfirm={handleConfirm}
                onCancel={options.onCancel || options.cancelText ? handleCancel : undefined}
                type={options.type}
            />
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};
