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
}
