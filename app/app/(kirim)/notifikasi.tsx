import React from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCheck } from 'lucide-react-native';
import { colors, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Button,
  SkeletonCard,
  EmptyState,
  ErrorState,
} from '../../src/ui';
import { useNotifications, useReadAllNotifications } from '../../src/api/hooks/useApi';
import { formatDateTime } from '../../src/utils/format';

export default function NotifikasiScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useNotifications();
  const { mutate: markAllRead, isPending: isMarking } = useReadAllNotifications();

  const items = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title="Notifikasi"
        canGoBack={false}
        rightAction={
          unreadCount > 0 ? (
            <Button
              label="Tandai Baca"
              variant="ghost"
              size="sm"
              loading={isMarking}
              onPress={() => markAllRead()}
            />
          ) : undefined
        }
      />

      {isLoading ? (
        <View style={styles.padding}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <ErrorState
          message={(error as any)?.message || 'Gagal memuat notifikasi.'}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum Ada Notifikasi"
          description="Pemberitahuan mengenai status kiriman, perjalanan, atau pesan akan muncul di sini."
          icon={<Bell size={44} color={colors.text.muted} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.padding}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const isUnread = !item.readAt;
            return (
              <Card
                variant={isUnread ? 'elevated' : 'flat'}
                style={[styles.itemCard, isUnread && styles.unreadCard]}
              >
                <View style={styles.itemHeader}>
                  <Text
                    variant="headline"
                    color={colors.text.primary}
                    weight={isUnread ? '700' : '500'}
                  >
                    {item.title}
                  </Text>
                  {isUnread && <View style={styles.dot} />}
                </View>
                <Text variant="callout" color={colors.text.secondary} style={styles.body}>
                  {item.body}
                </Text>
                <Text variant="caption" color={colors.text.muted}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padding: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surface,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  body: {
    marginBottom: spacing.xs,
  },
});
