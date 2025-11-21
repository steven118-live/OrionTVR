// components/UpdateModal.tsx (完整覆盖版)

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useUpdateStore } from '../stores/updateStore'; 

// 临时样式定义 (TS2339 修复)
const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '80%',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    versionRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%', 
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    buttonGroup: {
        flexDirection: 'row',
        marginTop: 20,
        justifyContent: 'space-around',
        width: '100%',
    },
});


const UpdateModal = () => {
    // 修正所有属性名和引入
    const {
        showUpdateModal,
        availableVersions,
        currentVersion,
        latestVersion,
        baselineVersion,
        downloading,
        downloadProgress,
        errorReason: error, // 修正: error -> errorReason
        closeModal: setShowUpdateModal, // 修正: setShowUpdateModal -> closeModal
        handleDownload, 
        installUpdate, // 修正: 无参数
        skipThisVersion,
        downloadedPath,
        switchBuildTarget, 
        currentBuildTarget,
        targetChannel, // 引入 targetChannel
        upstreamTagVersion,
        isUpdateAvailable, 
    } = useUpdateStore();

    const isDownloaded = downloadedPath !== null;
    const isError = error !== null;

    if (!showUpdateModal) return null;

    const renderContent = () => {
        if (isError) {
            return (
                <View>
                    <Text style={[styles.modalTitle, { color: 'red' }]}>更新检查失败</Text>
                    <Text>原因: {error}</Text>
                    <TouchableOpacity onPress={setShowUpdateModal}>
                        <Text>关闭</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (!isUpdateAvailable) {
            return (
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.modalTitle}>版本信息</Text>
                    <Text>当前版本: {currentVersion}</Text>
                    <Text>您已是最新版本。</Text>
                    <Text>官方源最新版本: {upstreamTagVersion || 'N/A'}</Text>
                    <TouchableOpacity onPress={setShowUpdateModal} style={{ marginTop: 15 }}>
                        <Text>确定</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={{ alignItems: 'center' }}>
                <Text style={styles.modalTitle}>发现新版本!</Text>
                <Text>当前版本: {currentVersion}</Text>
                <Text>最新版本 ({targetChannel} 通道): {latestVersion}</Text>
                <Text>官方源最新版本: {upstreamTagVersion || 'N/A'}</Text>

                {availableVersions.map(ver => (
                    <View key={ver} style={styles.versionRow}>
                        <Text>版本 {ver}</Text>
                        
                        {!isDownloaded && downloading && (
                            <Text>下载中: {downloadProgress.toFixed(0)}%</Text>
                        )}
                        {!isDownloaded && !downloading && (
                            // 修正 handleDownload 参数
                            <TouchableOpacity onPress={() => handleDownload(ver, targetChannel)}>
                                <Text style={{ color: 'blue' }}>下载</Text>
                            </TouchableOpacity>
                        )}
                        
                        {isDownloaded && !downloading && (
                            // 修正 installUpdate 调用
                            <TouchableOpacity onPress={() => installUpdate()}>
                                <Text style={{ color: 'green' }}>安装</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}

                <View style={styles.buttonGroup}>
                    <TouchableOpacity onPress={skipThisVersion}>
                        <Text>跳过</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => switchBuildTarget(targetChannel === 'dev' ? 'tag' : 'dev')}>
                        <Text>切换到 {targetChannel === 'dev' ? 'Tag' : 'Dev'} 通道</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={showUpdateModal}
            onRequestClose={setShowUpdateModal} 
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalView}>
                    {renderContent()}
                </View>
            </View>
        </Modal>
    );
};

export default UpdateModal;
