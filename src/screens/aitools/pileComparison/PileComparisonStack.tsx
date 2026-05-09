import React, { FC, useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackScreenProps } from '@/navigation/types';
import { PileComparisonProvider } from './PileComparisonContext';
import PileComparisonMainScreen from './PileComparisonContainer';
import MarpSlideViewerScreen from './MarpSlideViewerScreen';

export type PileComparisonStackParamList = {
  Main: undefined;
  ReportViewer: { reportId: string };
};

export type PileComparisonStackScreenProps<T extends keyof PileComparisonStackParamList> =
  NativeStackScreenProps<PileComparisonStackParamList, T>;

type RootProps = RootStackScreenProps<'PileComparison'>;

const Stack = createNativeStackNavigator<PileComparisonStackParamList>();

const PileComparisonStack: FC<RootProps> = ({ route }) => {
  const { bidId: rawBidId, reportId: rawReportId, initialRoute: rawInitialRoute } = (route.params as any) || {};

  const initialBidId = useMemo(() => {
    return rawBidId ? String(rawBidId) : undefined;
  }, [rawBidId]);

  const initialReportId = useMemo(() => {
    return rawReportId ? String(rawReportId) : undefined;
  }, [rawReportId]);

  const directToViewer = rawInitialRoute === 'ReportViewer' && !!rawReportId;

  return (
    <PileComparisonProvider initialBidId={initialBidId} initialReportId={initialReportId} initialRoute={directToViewer ? 'ReportViewer' : 'Main'}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={directToViewer ? 'ReportViewer' : 'Main'}
      >
        <Stack.Screen name="Main" component={PileComparisonMainScreen} />
        <Stack.Screen
          name="ReportViewer"
          component={MarpSlideViewerScreen}
          initialParams={directToViewer ? { reportId: initialReportId } : undefined}
          options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
        />
      </Stack.Navigator>
    </PileComparisonProvider>
  );
};

export default PileComparisonStack;
