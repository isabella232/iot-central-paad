import { StackNavigationProp } from "@react-navigation/stack";
import { LineData, LineValue, LineDatasetConfig } from "react-native-charts-wrapper";

export const Screens = {
    'HOME_SCREEN': 'Home',
    'TELEMETRY_SCREEN': 'Telemetry',
    'PROPERTIES_SCREEN': 'Properties',
    'COMMANDS_SCREEN': 'Commands',
    'HEALTH_SCREEN': 'Health'
}

/**
 * Parameters available for all routes
 */
export type NavigationParams = {
    title?: string,
    backTitle?: string,
    titleColor?: string,
    headerLeft?: any,
    icon?: {
        name: string,
        type: string
    }
}

// Type for getting the values of an object (lookup)
export type valueof<T> = T[keyof T];
/**
 * Defines type of screens
 */
export type NavigationScreens = {
    [k in valueof<typeof Screens>]: NavigationParams | undefined
}

export type NavigationProperty = StackNavigationProp<NavigationScreens, string>;

export type StateUpdater<T> = React.Dispatch<React.SetStateAction<T>>;


/**
 * Chart typings
 */

export type CustomLineDatasetConfig = LineDatasetConfig & { rgbcolor: string };
export interface ExtendedLineData extends LineData {
    dataSets: {
        itemId: string,
        values?: Array<number | LineValue>,
        label?: string,
        config?: CustomLineDatasetConfig
    }[]
}

export type ItemData = {
    id: string,
    value: any
}

export type ChartUpdateCallback = (itemdata: ItemData) => void;

/**
 * Health typings
 */

export const HealthRealTimeData = {
    Walking: 'Walking',
    StairClimbing: 'StairClimbing',
    Running: 'Running',
    Cycling: 'Cycling',
    Workout: 'Workout'
} as const;

export type GoogleFitStepResult = {
    source: string,
    steps: {
        date: string,
        value: number
    }[]
}