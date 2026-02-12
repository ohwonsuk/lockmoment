import React, { createContext, useContext, useState, useEffect } from 'react';
import { StorageService } from '../services/StorageService';

export type Screen = 'Dashboard' | 'Settings' | 'Permissions' | 'History' | 'Locking' | 'AddSchedule' | 'AppSelect' | 'NotificationSettings' | 'Login' | 'QRScanner' | 'QRGenerator' | 'TeacherClass' | 'Join' | 'JoinComplete' | 'LinkSubUser' | 'JoinInfo' | 'PermissionGuide' | 'AdminSchedule' | 'AppleJoin' | 'Children' | 'ChildDetail' | 'QR' | 'Notification' | 'MyInfo' | 'TabletKiosk';

interface NavigationContextType {
    currentScreen: Screen;
    currentParams: any;
    navigate: (screen: Screen, params?: any) => void;
    goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentScreen, setCurrentScreen] = useState<Screen>('Login');
    const [currentParams, setCurrentParams] = useState<any>({});

    useEffect(() => {
        const checkInitialScreen = async () => {
            const guided = await StorageService.hasGuidedPermissions();
            if (!guided) {
                setCurrentScreen('PermissionGuide');
                return;
            }

            const token = await StorageService.getAccessToken();
            if (!token) {
                setCurrentScreen('Login');
            } else {
                setCurrentScreen('Dashboard');
            }
        };
        checkInitialScreen();
    }, []);

    const navigate = (screen: Screen, params?: any) => {
        // Simple stack-like behavior could be implemented here if needed
        // For now, just switch screen
        setCurrentParams(params || {});
        setCurrentScreen(screen);
    };

    const goBack = () => {
        // Basic goBack implementation - for now just goes to Dashboard if no history stack
        // Ideally we should implement a stack
        setCurrentScreen('Dashboard');
    };

    return (
        <NavigationContext.Provider value={{ currentScreen, currentParams, navigate, goBack }}>
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

export const useAppRoute = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useAppRoute must be used within a NavigationProvider');
    }
    return { params: context.currentParams };
};
