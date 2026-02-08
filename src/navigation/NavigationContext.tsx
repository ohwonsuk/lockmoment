import React, { createContext, useContext, useState } from 'react';

export type Screen = 'Dashboard' | 'Settings' | 'Permissions' | 'History' | 'Locking' | 'AddSchedule' | 'AppSelect' | 'NotificationSettings' | 'Login' | 'QRScanner' | 'QRGenerator' | 'TeacherClass' | 'Join' | 'JoinComplete' | 'LinkSubUser' | 'JoinInfo';

interface NavigationContextType {
    currentScreen: Screen;
    currentParams: any;
    navigate: (screen: Screen, params?: any) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentScreen, setCurrentScreen] = useState<Screen>('Login');
    const [currentParams, setCurrentParams] = useState<any>({});

    const navigate = (screen: Screen, params?: any) => {
        setCurrentParams(params || {});
        setCurrentScreen(screen);
    };

    return (
        <NavigationContext.Provider value={{ currentScreen, currentParams, navigate }}>
            {children}
        </NavigationContext.Provider>
    );
};

export const useAppNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useAppNavigation must be used within a NavigationProvider');
    }
    return context;
};
