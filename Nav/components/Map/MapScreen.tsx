import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import SearchBar from './SearchBar';
import RouteOptionsCard from './RouteOptionsCard';
import CurrentLocationButton from './CurrentLocationButton';
import HomeScreenBottom from './HomeScreenBottom';
import NavigationCard from './NavigationCard'; // 引入新的导航卡片组件

import { env } from '../../config';
import { getStudyApiUrl } from '../../config/network';
import { getDistance } from 'geolib';
import WebRTCService, { CallState } from '../../services/communication/WebRTCService';
import DeviceIdManager from '../../services/core/DeviceIdManager';
import IncomingCallUI from '../IncomingCallUI';
import { useCallOverlay } from '../CallOverlayProvider';

// Feature flag: disable WebRTC signaling on app start
const WEBRTC_ENABLED = false;
export function MapScreen() {
    const overlay = useCallOverlay();
    const mapRef = useRef<MapView>(null);
    const [region, setRegion] = useState<Region | null>(null);
    const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null);
    const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
    const [traveledCoords, setTraveledCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [steps, setSteps] = useState<any[]>([]);
    const [isNavigating, setIsNavigating] = useState(false);
    const [currentInstruction, setCurrentInstruction] = useState<string>(''); // 当前步骤指令
    const [currentHtmlInstruction, setCurrentHtmlInstruction] = useState<string>(''); // 当前步骤指令（HTML 格式）
    const searchBarRef = useRef<{ clear: () => void } | null>(null);
    const routeOptionsCardRef = useRef<{ handleCompleteNavigation: () => void } | null>(null);

    // Ensure deviceId and webRTCService are declared before any usage
    const [deviceId, setDeviceId] = useState<string>('');
    useEffect(() => {
        DeviceIdManager.getInstance().getDeviceId().then(setDeviceId);
    }, []);
    const webRTCService = useRef<WebRTCService | null>(null);

    const clearSearch = () => {
        console.log('Search clearing...'); // 调试日志
        if (searchBarRef.current) {
            console.log('Search clearing1...'); // 调试日志
            searchBarRef.current.clear();  // 调用 SearchBar 中的 clear 方法
            console.log('Search clearing2...'); // 调试日志
        }
    };

    useEffect(() => {
        fetchCurrentLocation();

        if (WEBRTC_ENABLED && deviceId) {
            // 初始化 WebRTC 服务（受开关控制）
            webRTCService.current = new WebRTCService(deviceId);

            // 设置回调
            webRTCService.current.onStateChange = (state) => {
                setCallState(prev => ({ ...prev, ...state }));
            };

            webRTCService.current.onIncomingCall = (callerId) => {
                console.log('Incoming call from:', callerId);
                setCallState(prev => ({ ...prev, incomingCall: true, callerId }));
                // Show global overlay
                overlay.showIncoming({
                    callerId,
                    onAccept: async () => {
                        await webRTCService.current?.acceptCall();
                        setCallState(prev => ({ ...prev, incomingCall: false, isInCall: true }));
                    },
                    onReject: () => {
                        webRTCService.current?.rejectCall();
                        setCallState(prev => ({ ...prev, incomingCall: false }));
                    },
                    onRejectWithMessage: () => {
                        webRTCService.current?.rejectCallWithBusyMessage();
                        setCallState(prev => ({ ...prev, incomingCall: false }));
                    }
                });
            };

            webRTCService.current.onCallEnd = () => {
                console.log('Call ended');
                setCallState(prev => ({ 
                    ...prev, 
                    incomingCall: false, 
                    isInCall: false,
                    callerId: undefined 
                }));
            };

            return () => {
                webRTCService.current?.destroy();
            };
        }

        // 未启用 WebRTC 时，无需清理
        return () => {};
    }, [deviceId]);
    useEffect(() => {
        console.log('Destination updated:', destination);
    }, [destination]);

    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    
    // WebRTC 通信状态
    const [callState, setCallState] = useState<CallState>({
        isConnected: false,
        isInCall: false,
        remoteStream: null,
        localStream: null,
        messages: [],
        incomingCall: false
    });

    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;
        let timer: NodeJS.Timeout | null = null;

        console.log('isNavigating1:', isNavigating); // 调试日志

        if (isNavigating) {
            const startTracking = async () => {
                // 开始位置追踪
                locationSubscription = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, distanceInterval: 1 },
                    (location) => {
                        const { latitude: locLat, longitude: locLng } = location.coords;
                        updateRegion(locLat, locLng);

                        // 更新已走过的路线
                        setTraveledCoords((prev) => [...prev, { latitude: locLat, longitude: locLng }]);

                        // 更新当前位置
                        setLatitude(locLat);
                        setLongitude(locLng);
                    }
                );

                // 每隔一秒获取当前位置，更新状态
                timer = setInterval(async () => {
                    try {
                        const location = await Location.getCurrentPositionAsync({});
                        const { latitude: locLat, longitude: locLng } = location.coords;
                        console.log('Current location:', locLat, locLng); // 调试日志
                        setLatitude(locLat);
                        setLongitude(locLng);
                    } catch (error) {
                        console.error('Error getting location:', error);
                    }
                }, 1000) as unknown as NodeJS.Timeout;
            };
            startTracking();
        }

        return () => {
            if (locationSubscription) locationSubscription.remove();
            if (timer) clearInterval(timer);
        };
    }, [isNavigating]);

    useEffect(() => {
        if (latitude !== null && longitude !== null) {
            checkTurn({ latitude, longitude });
        }
    }, [latitude, longitude]);
    const fetchCurrentLocation = async () => {
        console.log('CurrentLocationButton pressed - fetching location...');
        const location = await fetchLocationCoords();
        console.log('Fetched location:', location);
        if (location) {
            console.log('Setting region to:', location);
            const newRegion = {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setRegion(newRegion);
            // 通过动画移动镜头，提升可见反馈
            updateRegion(newRegion.latitude, newRegion.longitude);
            console.log('Region updated successfully');
        } else {
            console.log('No location returned from fetchLocationCoords');
        }
    };

    const fetchLocationCoords = async (): Promise<{ latitude: number; longitude: number } | null> => {
        try {
            console.log('Requesting location permission...');
            const { status } = await Location.requestForegroundPermissionsAsync();
            console.log('Location permission status:', status);
            if (status !== 'granted') {
                console.log('Location permission denied');
                Alert.alert('Permission Denied', 'The app needs location permission to display the current location.');
                return null;
            }

            console.log('Getting current position...');
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = location.coords;
            console.log('Current position obtained:', { latitude, longitude });

            return { latitude, longitude };
        } catch (error) {
            console.error('Error fetching current location:', error);
            Alert.alert('Location Error', `An error occurred while fetching location information: ${error}`);
            return null;
        }
    };

    const updateRegion = (latitude: number, longitude: number) => {
        console.log('updateRegion called with:', { latitude, longitude });
        console.log('mapRef.current exists:', !!mapRef.current);
        if (mapRef.current) {
            const newRegion = {
                latitude,
                longitude,
                latitudeDelta: region?.latitudeDelta || 0.01,
                longitudeDelta: region?.longitudeDelta || 0.01,
            };
            console.log('Animating to region:', newRegion);
            mapRef.current.animateToRegion(newRegion, 1000);
        } else {
            console.log('mapRef.current is null, cannot animate to region');
        }
    };

    const handleMoveCamera = (coords: { latitude: number; longitude: number }) => {
        updateRegion(coords.latitude, coords.longitude);
    };

    const sendNavigationFeedback = async (direction: 'left' | 'right' | 'straight' | 'arrival') => {
        try {
            const base = getStudyApiUrl();
            const post = async (path: string, body?: any) => {
                return fetch(`${base}${path}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body ? JSON.stringify(body) : undefined,
                });
            };
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            if (direction === 'left') {
                // 左转 -> /stimulus flow 左flow，执行3次
                const payload = {
                    event: 'stimulus',
                    mode: ['tongue'],
                    pattern: { type: 'flow', name: 'D-A' }, // 左向：D->A
                };
                await post('/stimulus', payload);
                await sleep(3000);
                await post('/stop_all_stimulus');
                return;
            }

            if (direction === 'right') {
                // 右转 -> /stimulus flow 右flow，执行3次
                const payload = {
                    event: 'stimulus',
                    mode: ['tongue'],
                    pattern: { type: 'flow', name: 'A-D' }, // 右向：A->D
                };
                await post('/stimulus', payload);
                await sleep(3000);
                await post('/stop_all_stimulus');
                return;
            }

            if (direction === 'straight' || direction === 'arrival') {
                // 直行/到达 -> start_all 3s 后 stop_all
                await post('/start_all_stimulus');
                await sleep(3000);
                await post('/stop_all_stimulus');
                return;
            }
        } catch (error) {
            console.error('🔴 Error sending stimulus feedback:', error);
        }
    };

    const checkTurn = (currentCoords: { latitude: number; longitude: number }) => {
        console.log('checkTurn called with currentCoords:', currentCoords); // 调试日志
        // 确保 steps 不为空且 currentStepIndex 是有效的
        if (steps.length === 0) {
            console.log('No steps available for navigation.');
            return;
        }

        // 检查是否还有下一步
        if (steps.length > currentStepIndex && currentStepIndex !== steps.length - 1) {
            const currentStep = steps[currentStepIndex];
            const nextStep = steps[currentStepIndex + 1];
            const { lat: latitude, lng: longitude } = currentStep.end_location;
            const distance = calculateDistance(currentCoords, { latitude, longitude });

            if (distance <= 10) {
                // 如果下一步存在，根据 maneuver 执行
                if (nextStep) {
                    let instruction = '';
                    const rawInstruction = nextStep.instruction.replace(/<[^>]+>/g, '');
                    const html_instruction = nextStep.instruction;
                    console.log('Raw Instruction:', rawInstruction); // 调试日志
                    // 根据 maneuver 来判断操作
                    if (nextStep.maneuver && (nextStep.maneuver.includes('left') || nextStep.maneuver.includes('right'))) {
                        if (nextStep.maneuver.includes('left')) {
                            instruction = 'left';
                        } else if (nextStep.maneuver.includes('right')) {
                            instruction = 'right';
                        } else {
                            instruction = 'straight';
                        }
                    } else {
                        // 如果 maneuver 为 null 或者没有方向，解析 instruction 内容来决定动作
                        if (rawInstruction.includes('Turn left')) {
                            instruction = 'left';
                        } else if (rawInstruction.includes('Turn right')) {
                            instruction = 'right';
                        } else {
                            instruction = 'straight';
                        }
                    }
                    console.log('Instruction:', instruction); // 调试日志
                    if (instruction === 'left' || instruction === 'right') {
                        sendNavigationFeedback(instruction as 'left' | 'right');
                    } else if (instruction === 'straight') {
                        sendNavigationFeedback('straight');
                    }
                    setCurrentInstruction(rawInstruction); // 更新当前步骤指令
                    setCurrentHtmlInstruction(html_instruction); // 更新当前步骤指令（HTML 格式）
                    setCurrentStepIndex((prev) => prev + 1); // 进入下一步
                }
            }
        } else {
            // 如果是最后一步，判断是否到达
            const currentStep = steps[currentStepIndex];
            const { lat: latitude, lng: longitude } = currentStep.end_location;
            const distance = calculateDistance(currentCoords, { latitude, longitude });
            if (distance <= 10) {
                const instruction = currentStep.instruction.replace(/<[^>]+>/g, '');
                setCurrentInstruction(instruction); // 更新当前步骤指令
                setCurrentHtmlInstruction(currentStep.instruction); // 更新当前步骤指令（HTML 格式）
                console.log('Instruction:', instruction); // 调试日志
                sendNavigationFeedback('arrival');
                handleExitNavigation();
                Alert.alert('Navigation Completed', 'You have reached your destination.');
            }
        }
    };

    // const calculateDistance = (
    //     coord1: { latitude: number; longitude: number },
    //     coord2: { latitude: number; longitude: number }
    // ) => {
    //     const R = 6371e3; // 地球半径，单位：米
    //     const φ1 = (coord1.latitude * Math.PI) / 180;
    //     const φ2 = (coord2.latitude * Math.PI) / 180;
    //     const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    //     const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    //     const a =
    //         Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    //         Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    //     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    //     return R * c; // 距离，单位：米
    // };
    const calculateDistance = (
        coord1: { latitude: number; longitude: number },
        coord2: { latitude: number; longitude: number }
    ): number => {
        return getDistance(coord1, coord2); // 返回两点间的距离，单位：米
    };

    const handleDestinationSelect = async (place: { placeId: string; description: string }) => {
        try {
            const response = await axios.get(
                'https://maps.googleapis.com/maps/api/place/details/json',
                {
                    params: {
                        place_id: place.placeId,
                        key: env.GOOGLE_PLACES_API_KEY,
                    },
                }
            );

            const result = response.data.result;
            if (result && result.geometry) {
                const { lat, lng } = result.geometry.location;
                const coord = { latitude: lat, longitude: lng };
                setDestination(coord);
                updateRegion(coord.latitude, coord.longitude);
            } else {
                Alert.alert('Error', 'Failed to fetch coordinates for the selected place.');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch details for the selected place.');
            console.error(error);
        }
    };

    const onStartNavigation = async (stepsData: any[]) => {
        console.log('onStartNavigation called with stepsData:', stepsData); // 调试日志
        if (stepsData.length === 0) {
            Alert.alert('Error', 'No navigation steps available.');
            console.error('No navigation steps available.');
            return;
        }
        console.log('Starting navigation...'); // 调试日志
        setSteps(stepsData);
        console.log('steps:', steps); // 调试日志
        setCurrentStepIndex(0);
        console.log('currentStepIndex:', currentStepIndex); // 调试日志
        setTraveledCoords([]);
        console.log('traveledCoords:', traveledCoords); // 调试日志
        let currentInstruction_info = stepsData[0].instruction.replace(/<[^>]*>?/gm, ''); // 获取第一步指令
        console.log('currentInstruction1:', currentInstruction_info); // 调试日志
        setCurrentInstruction(currentInstruction_info || ''); // 初始化第一步
        console.log('currentInstruction2:', currentInstruction); // 调试日志
        setCurrentHtmlInstruction(stepsData[0].instruction || ''); // 初始化第一步（HTML 格式）
        setIsNavigating(true);
        console.log('isNavigating:', isNavigating);

        if (destination) updateRegion(destination.latitude, destination.longitude); // 更新地图视角
    };

    const handleAcceptCall = async () => {
        console.log('Accepting incoming call');
        await webRTCService.current?.acceptCall();
        setCallState(prev => ({ ...prev, incomingCall: false, isInCall: true }));
    };

    const handleRejectCall = () => {
        console.log('Rejecting incoming call');
        webRTCService.current?.rejectCall();
        setCallState(prev => ({ ...prev, incomingCall: false }));
    };

    const handleRejectCallWithMessage = () => {
        console.log('Rejecting call with busy message');
        webRTCService.current?.rejectCallWithBusyMessage();
        setCallState(prev => ({ ...prev, incomingCall: false }));
    };

    function handleExitNavigation() {
        console.log('Exiting navigation...'); // 调试日志
        setIsNavigating(false);
        console.log('isNavigating:', isNavigating); // 调试日志
        setSteps([]);
        setCurrentStepIndex(0);
        setRouteCoords([]);
        setCurrentInstruction('');
        setCurrentHtmlInstruction('');
        setTraveledCoords([]);
        setDestination(null);
        console.log('Destination:', destination); // 调试日志
        clearSearch();
        console.log('Search cleared.'); // 调试日志
        fetchCurrentLocation();
        console.log('1');
        if (region) {
            handleMoveCamera({ latitude: region.latitude, longitude: region.longitude });
        }
        if (routeOptionsCardRef.current) {
            console.log('2');
            routeOptionsCardRef.current.handleCompleteNavigation();
        }
        console.log('3');
    }


    return (
        <View style={styles.container}>
            {region && (
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    region={region}
                    showsUserLocation={true}
                >
                    {/* {destination && */}
                    <Marker coordinate={destination || { latitude: 0, longitude: 0 }} title="Destination">
                        <FontAwesome name="map-marker" size={39} color="#F12C30" />
                        {/* <Fontisto name="map-marker-alt" size={36} color="red" /> */}
                    </Marker>
                    {/* } */}
                    <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="rgb(0, 128, 255)" />
                </MapView>
            )}

            {/* 使用 NavigationCard 组件来显示导航指令 */}
            {isNavigating && currentHtmlInstruction && (
                <NavigationCard instruction={currentHtmlInstruction} />
            )}

            {!isNavigating && (
                <SearchBar
                    ref={searchBarRef}
                    onSelectDestination={(place) => {
                        if (place === null) {
                            setRouteCoords([]);
                            setTraveledCoords([]);
                            setDestination(null);
                        } else {
                            handleDestinationSelect(place);
                        }
                    }}
                />
            )}

            <CurrentLocationButton onPress={fetchCurrentLocation} />
            {destination && (
                <RouteOptionsCard
                    onClose={() => setDestination(null)}
                    origin={{ latitude: region!.latitude, longitude: region!.longitude }}
                    destination={destination}
                    onRouteSelected={(coords) => {
                        setRouteCoords(coords);
                    }}
                    onMoveCamera={handleMoveCamera}
                    onStartNavigation={onStartNavigation}
                    onExitNavigation={handleExitNavigation}
                />
            )}

            {!destination && region && (
                <HomeScreenBottom locationCoords={{ latitude: region.latitude, longitude: region.longitude }} />
            )}

            {/* 来电 UI */}
            <IncomingCallUI
                visible={callState.incomingCall}
                callerId={callState.callerId || 'Unknown'}
                onAccept={handleAcceptCall}
                onReject={handleRejectCall}
                onRejectWithMessage={handleRejectCallWithMessage}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default MapScreen;