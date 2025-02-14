/* eslint-disable react-native/no-inline-styles */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {RouteProp} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import CardView from 'CardView';
import {Loader, Name, Detail} from 'components';
import FileUpload from 'FileUpload';
import {
  useLogger,
  useSensors,
  useProperties,
  IIcon,
  useDeliveryInterval,
  useSimulation,
  useIoTCentralClient,
} from 'hooks';
import Logs from 'Logs';
import React, {useCallback, useEffect, useRef} from 'react';
import {Platform, Alert} from 'react-native';
import {
  IIoTCCommand,
  IIoTCCommandResponse,
  IIoTCProperty,
  IOTC_EVENTS,
  IIoTCClient,
} from 'react-native-azure-iotcentral-client';

import Strings, {resolveString} from 'strings';
import {
  NavigationParams,
  PagesNavigator,
  PROPERTY,
  ScreenNames,
  Screens,
  LIGHT_TOGGLE_COMMAND,
  ENABLE_DISABLE_COMMAND,
  SET_FREQUENCY_COMMAND,
  TELEMETRY,
  DATA_AVAILABLE_EVENT,
  NavigationScreens,
  ItemProps,
} from 'types';
import {DEFAULT_DELIVERY_INTERVAL} from './sensors';
import {Icon} from '@rneui/themed';
import {playTorch} from 'tools/Torch';

const Tab = createBottomTabNavigator<NavigationScreens>();

const Root = React.memo<{
  route: RouteProp<
    Record<string, NavigationParams & {previousScreen?: string}>,
    'Root'
  >;
  navigation: PagesNavigator;
}>(({navigation}) => {
  const [, append] = useLogger();
  const [sensors, addSensorListener, removeSensorListener] = useSensors();
  const [deliveryInterval] = useDeliveryInterval();
  // const [healths, addHealthListener, removeHealthListener] = useHealth();
  const {
    loading: propertiesLoading,
    properties,
    updateProperty,
  } = useProperties();
  const [simulated] = useSimulation();

  const onConnectionRefresh = useCallback(
    async (client: IIoTCClient) => {
      await client.fetchTwin();
      await client.sendProperty({
        [PROPERTY]: {
          __t: 'c',
          ...properties.reduce((obj, p) => ({...obj, [p.id]: p.value}), {}),
        },
      });
    },
    [properties],
  );
  const [iotcentralClient] = useIoTCentralClient(onConnectionRefresh);

  const iconsRef = useRef<{[x in ScreenNames]: IIcon}>({
    [Screens.TELEMETRY_SCREEN]: Platform.select({
      ios: {
        name: 'stats-chart-outline',
        type: 'ionicon',
      },
      android: {
        name: 'chart-bar',
        type: 'material-community',
      },
    }) as IIcon,
    [Screens.PROPERTIES_SCREEN]: Platform.select({
      ios: {
        name: 'create-outline',
        type: 'ionicon',
      },
      android: {
        name: 'playlist-edit',
        type: 'material-community',
      },
    }) as IIcon,
    [Screens.HEALTH_SCREEN]: {
      name: 'heartbeat',
      type: 'font-awesome',
    } as IIcon,
    [Screens.FILE_UPLOAD_SCREEN]: Platform.select({
      ios: {
        name: 'cloud-upload-outline',
        type: 'ionicon',
      },
      android: {
        name: 'cloud-upload-outline',
        type: 'material-community',
      },
    }) as IIcon,
    [Screens.LOGS_SCREEN]: Platform.select({
      ios: {
        name: 'console',
        type: 'material-community',
      },
      android: {
        name: 'console',
        type: 'material-community',
      },
    }) as IIcon,
  });

  const icons = iconsRef.current;
  const sensorRef = useRef(sensors);
  // const healthRef = useRef(healths);

  const sendToCentralHandler = useCallback(
    async (componentName: string, id: string, value: any) => {
      if (iotcentralClient && iotcentralClient.isConnected()) {
        await iotcentralClient.sendTelemetry(
          {[id]: value},
          {'$.sub': componentName},
        );
      }
    },
    [iotcentralClient],
  );

  const onCommandUpdate = useCallback(
    async (command: IIoTCCommand) => {
      let data: any;
      data = JSON.parse(command.requestPayload);
      Alert.alert(
        Strings.Client.Commands.Alert.Title,
        resolveString(Strings.Client.Commands.Alert.Message, command.name),
      );

      if (command.name === LIGHT_TOGGLE_COMMAND) {
        await command.reply(
          IIoTCCommandResponse.SUCCESS,
          '{"execution":"started"}',
        );
        const torchParams = data as {
          pulses: number;
          duration: number;
          delay?: number;
        };
        append({
          eventName: 'INFO',
          eventData: `Received Light Toggle Command. Light will be turned on for ${
            torchParams.duration
          } seconds ${torchParams.pulses} times with ${
            torchParams.delay ?? 1
          } seconds between each power.`,
        });
        await playTorch(
          torchParams.pulses,
          torchParams.duration,
          torchParams.delay || 1,
        );
        append({
          eventName: 'INFO',
          eventData: 'End turning on/off light.',
        });
        return;
      }
      if (data.sensor) {
        const sensor = sensorRef.current.find(s => s.id === data.sensor);
        if (sensor) {
          switch (command.name) {
            case ENABLE_DISABLE_COMMAND:
              sensor.enable(data.enable ? data.enable : false);
              await command.reply(
                IIoTCCommandResponse.SUCCESS,
                `{"enabled":${data.enable}}`,
              );
              break;
            case SET_FREQUENCY_COMMAND:
              sensor.sendInterval(data.interval ? data.interval * 1000 : 5000);
              await command.reply(
                IIoTCCommandResponse.SUCCESS,
                `{"interval":${data.interval}}`,
              );
              break;
          }
        }
      }
    },
    [append],
  );

  const onPropUpdate = useCallback(
    async (prop: IIoTCProperty) => {
      let {name, value} = prop;
      if (value.__t === 'c') {
        // inside a component: TODO: change sdk
        name = Object.keys(value).filter(v => v !== '__t')[0];
        value = value[name];
      }
      console.log(`Prop received ${name}:${JSON.stringify(value)}`);
      updateProperty(name, value);
      await prop.ack();
    },
    [updateProperty],
  );

  const sendTelemetryHandler = useCallback(
    (id: string, value: any) => sendToCentralHandler(TELEMETRY, id, value),
    [sendToCentralHandler],
  );
  // const sendHealthHandler = useCallback(
  //   (id: string, value: any) => sendToCentralHandler(HEALTH, id, value),
  //   [sendToCentralHandler],
  // );

  useEffect(() => {
    const currentSensorRef = sensorRef.current;
    // const currentHealthRef = healthRef.current;
    if (iotcentralClient) {
      currentSensorRef.forEach(s =>
        addSensorListener(s.id, DATA_AVAILABLE_EVENT, sendTelemetryHandler),
      );
      append({
        eventName: 'INFO',
        eventData: 'Sensor initialized.',
      });

      // currentHealthRef.forEach(h =>
      //   addHealthListener(h.id, DATA_AVAILABLE_EVENT, sendHealthHandler),
      // );
      // append({
      //   eventName: 'INFO',
      //   eventData: 'Health initialized.',
      // });

      append({
        eventName: 'INFO',
        eventData: 'Properties initialized.',
      });

      iotcentralClient.on(IOTC_EVENTS.Commands, onCommandUpdate);
      iotcentralClient.on(IOTC_EVENTS.Properties, onPropUpdate);
      iotcentralClient.fetchTwin();
    }

    return () => {
      currentSensorRef.forEach(s =>
        removeSensorListener(s.id, DATA_AVAILABLE_EVENT, sendTelemetryHandler),
      );
      // currentHealthRef.forEach(h =>
      //   removeHealthListener(h.id, DATA_AVAILABLE_EVENT, sendHealthHandler),
      // );
    };
  }, [
    iotcentralClient,
    // addHealthListener,
    addSensorListener,
    append,
    onCommandUpdate,
    onPropUpdate,
    // removeHealthListener,
    removeSensorListener,
    // sendHealthHandler,
    sendTelemetryHandler,
    navigation,
  ]);

  // react to sendinterval change
  useEffect(() => {
    if (deliveryInterval !== DEFAULT_DELIVERY_INTERVAL) {
      sensorRef.current.forEach(sensor =>
        sensor.sendInterval(deliveryInterval * 1000),
      );
    }
  }, [deliveryInterval]);

  return (
    <>
      {simulated && (
        <Name style={{textAlign: 'center', marginTop: 5}}>
          Device: <Detail>{iotcentralClient?.id}</Detail>
        </Name>
      )}
      <Tab.Navigator
        key="tab"
        screenOptions={{
          headerShown: false,
        }}>
        <Tab.Screen
          name={Screens.TELEMETRY_SCREEN}
          options={{
            tabBarIcon: ({color, size}) => (
              <TabBarIcon icon={icons.Telemetry} color={color} size={size} />
            ),
          }}>
          {getCardView(sensors, 'Telemetry')}
        </Tab.Screen>
        {/* <Tab.Screen
          name={Screens.HEALTH_SCREEN}
          options={{
            tabBarIcon: ({color, size}) => (
              <TabBarIcon icon={icons.Health} color={color} size={size} />
            ),
          }}>
          {getCardView(healths, 'Health', true)}
        </Tab.Screen> */}
        <Tab.Screen
          name={Screens.PROPERTIES_SCREEN}
          options={{
            tabBarIcon: ({color, size}) => (
              <TabBarIcon icon={icons.Properties} color={color} size={size} />
            ),
          }}>
          {propertiesLoading
            ? () => (
                <Loader
                  message={Strings.Client.Properties.Loading}
                  visible={true}
                  style={{flex: 1, justifyContent: 'center'}}
                />
              )
            : () => (
                <CardView
                  items={properties}
                  componentName="Property"
                  onEdit={async (item, value) => {
                    try {
                      await iotcentralClient?.sendProperty({
                        [item.id]: value,
                      });
                      Alert.alert(
                        'Property',
                        resolveString(
                          Strings.Client.Properties.Delivery.Success,
                          item.name,
                        ),
                        [{text: 'OK'}],
                      );
                    } catch (e) {
                      Alert.alert(
                        'Property',
                        resolveString(
                          Strings.Client.Properties.Delivery.Failure,
                          item.name,
                        ),
                        [{text: 'OK'}],
                      );
                    }
                  }}
                />
              )}
        </Tab.Screen>
        <Tab.Screen
          name={Screens.FILE_UPLOAD_SCREEN}
          component={FileUpload}
          options={{
            tabBarIcon: ({color, size}) => (
              <TabBarIcon
                icon={icons['Image Upload']}
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name={Screens.LOGS_SCREEN}
          component={Logs}
          options={{
            tabBarIcon: ({color, size}) => (
              <TabBarIcon icon={icons.Logs} color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </>
  );
});

const getCardView = (items: ItemProps[], name: string) => () =>
  (
    <CardView
      items={items}
      componentName={name}
      onItemLongPress={item => {
        item.enable(!item.enabled);
      }}
      // TEMP: temporary disabled charts
      // onItemPress={
      //   detail
      //     ? item => {
      //         navigation.navigate('Insight', {
      //           chartType:
      //             item.id === AVAILABLE_SENSORS.GEOLOCATION
      //               ? ChartType.MAP
      //               : ChartType.DEFAULT,
      //           currentValue: item.value,
      //           telemetryId: item.id,
      //           title: camelToName(item.id),
      //           backTitle: 'Telemetry',
      //         });
      //       }
      //     : undefined
      // }
    />
  );

const TabBarIcon = React.memo<{icon: IIcon; color: string; size: number}>(
  ({icon, color, size}) => {
    return (
      <Icon
        name={icon ? icon.name : 'home'}
        type={icon ? icon.type : 'ionicon'}
        size={size}
        color={color}
      />
    );
  },
);

export default Root;
