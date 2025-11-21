// components/settings/UpdateSection.tsx (完整覆盖版)

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useUpdateStore } from '../../stores/updateStore'; 

// 临时样式定义 (TS2307 修复)
const styles = StyleSheet.create({
    sectionContainer: { padding: 15, borderBottomWidth: 1, borderColor: '#ccc' },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    checkButton: { backgroundColor: '#007AFF', padding: 10, borderRadius: 5, marginTop: 10 },
    buttonText: { color: 'white', textAlign: 'center' },
    errorText: { color: 'red', marginTop: 5 },
    updateContainer: { marginTop: 15, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5 },
    updateAvailableText: { color: 'green', fontWeight: 'bold', marginBottom: 5 },
    versionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
    downloadButton: { backgroundColor: '#34C759', padding: 5, borderRadius: 5 },
    skipButton: { marginTop: 10, padding: 5, backgroundColor: '#FF3B30', borderRadius: 5 },
    skipText: { color: 'white', textAlign: 'center' },
    latestText: { color: 'gray', marginTop: 10 },
    statusText: { color: '#007AFF' },
});


const UpdateSection = () => {
    // 修正所有属性名和引入
    const {
        currentVersion,
        latestVersion: remoteVersion, 
        availableVersions,
        baselineVersion,
        isUpdateAvailable: updateAvailable, 
        downloading,
        downloadProgress,
        errorReason: error, 
        isLatestVersion,
        handleDownload,
        skipThisVersion,
        checkForUpdate, // 无参数
        targetChannel, // 引入 targetChannel
        currentBuildTarget,
    } = useUpdateStore();

    // 修正 checkForUpdate 调用
    const handleCheckUpdate = async () => {
        await checkForUpdate(); 
    };

    const renderDownloadButton = (ver: string) => {
        if (downloading) {
            return <Text style={styles.statusText}>下载中: {downloadProgress.toFixed(0)}%</Text>;
        }
        
        return (
            <TouchableOpacity 
                // 修正 handleDownload 参数
                onPress={() => handleDownload(ver, targetChannel)} 
                style={styles.downloadButton}
            >
                <Text style={styles.buttonText}>下载 {ver}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.sectionContainer}>
            <Text style={styles.title}>更新信息</Text>
            <Text>当前版本: {currentVersion} ({currentBuildTarget})</Text>
            <Text>最新版本: {remoteVersion}</Text>
            <Text>基线版本: {baselineVersion}</Text>

            <TouchableOpacity onPress={handleCheckUpdate} style={styles.checkButton}>
                <Text style={styles.buttonText}>检查更新</Text>
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>错误: {error}</Text>}

            {updateAvailable && availableVersions.length > 0 && (
                <View style={styles.updateContainer}>
                    <Text style={styles.updateAvailableText}>有新版本可用!</Text>
                    {availableVersions.map(ver => (
                        <View key={ver} style={styles.versionRow}>
                            <Text>版本 {ver}</Text>
                            {renderDownloadButton(ver)}
                        </View>
                    ))}
                    <TouchableOpacity onPress={skipThisVersion} style={styles.skipButton}>
                        <Text style={styles.skipText}>跳过此版本</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isLatestVersion && !updateAvailable && !error && (
                <Text style={styles.latestText}>您已是最新版本。</Text>
            )}
        </View>
    );
};

export default UpdateSection;
