import React, { createContext, useContext, useState } from 'react';

export type Screen = 'Dashboard' | 'Settings' | 'Permissions' | 'History' | 'Locking' | 'AddSchedule' | 'AppSelect' | 'NotificationSettings' | 'Login' | 'QRScanner' | 'QRGenerator' | 'TeacherClass';

interface NavigationContextType {
    currentScreen: Screen;
    navigate: (screen: Screen) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentScreen, setCurrentScreen] = useState<Screen>('Dashboard');

    const navigate = (screen: Screen) => setCurrentScreen(screen);

    return (
        <NavigationContext.Provider value={{ currentScreen, navigate }}>
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
