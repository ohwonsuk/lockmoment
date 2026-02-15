import { apiService } from './ApiService';

export interface AppCategory {
    id: string;
    display_name: string;
}

export class MetaDataService {
    /**
     * 앱 카테고리 목록 조회
     */
    static async getAppCategories(): Promise<AppCategory[]> {
        try {
            const response = await apiService.get<{ success: boolean; categories: AppCategory[] }>('/meta/categories');
            return response.categories || [];
        } catch (error) {
            console.error('[MetaDataService] getAppCategories failed:', error);
            return [];
        }
    }

    /**
     * 잠금 가능한 앱 목록 조회
     */
    static async getApps(): Promise<any[]> {
        try {
            const response = await apiService.get<{ success: boolean; apps: any[] }>('/meta/apps');
            return response.apps || [];
        } catch (error) {
            console.error('[MetaDataService] getApps failed:', error);
            return [];
        }
    }
}
