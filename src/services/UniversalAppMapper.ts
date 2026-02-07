
export interface AppMapping {
    universal: string;
    ios: string;
    android: string;
}

const APP_MAPPINGS: AppMapping[] = [
    { universal: 'youtube', ios: 'com.google.ios.youtube', android: 'com.google.android.youtube' },
    { universal: 'instagram', ios: 'com.burbn.instagram', android: 'com.instagram.android' },
    { universal: 'tiktok', ios: 'com.zhiliaoapp.musically', android: 'com.ss.android.ugc.trill' },
    { universal: 'facebook', ios: 'com.facebook.Facebook', android: 'com.facebook.katana' },
];

export class UniversalAppMapper {
    static mapToNative(universalNames: string[], platform: 'ios' | 'android'): string[] {
        const nativeIds: string[] = [];

        for (const name of universalNames) {
            const mapping = APP_MAPPINGS.find(m => m.universal.toLowerCase() === name.toLowerCase());
            if (mapping) {
                nativeIds.push(platform === 'ios' ? mapping.ios : mapping.android);
            } else {
                // If no mapping found, assume it might already be a native ID
                nativeIds.push(name);
            }
        }

        return nativeIds;
    }

    static mapToUniversal(nativeId: string, platform: 'ios' | 'android'): string {
        const mapping = APP_MAPPINGS.find(m =>
            (platform === 'ios' && m.ios === nativeId) ||
            (platform === 'android' && m.android === nativeId)
        );
        return mapping ? mapping.universal : nativeId;
    }

    static getDefaultUniversalIds(): string[] {
        return APP_MAPPINGS.map(m => m.universal);
    }
}
