import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';
import type { ChatMessage } from '@kirimin/shared';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { Text, TopBar, SkeletonCard, EmptyState, ErrorState } from '../../src/ui';
import { useOrder, useOrderMessages, useSendMessage } from '../../src/api/hooks/useApi';
import { useAuth } from '../../src/auth/AuthContext';
import { api } from '../../src/api/client';
import { formatTime } from '../../src/utils/format';

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const listRef = useRef<FlatList>(null);

  const { data: order } = useOrder(orderId);
  const { data: messages, isLoading, isError, error, refetch } = useOrderMessages(orderId);
  const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage();

  const [input, setInput] = useState('');

  // Mark messages as read on mount
  useEffect(() => {
    if (orderId) {
      api.post(`/orders/${orderId}/messages/read`).catch(() => {});
    }
  }, [orderId]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput('');
    try {
      await sendMessage({ orderId, body: text });
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim pesan');
    }
  };

  const otherPersonName =
    user?.id === order?.sender.id ? order?.driver?.name || 'Driver' : order?.sender.name || 'Pengirim';

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title={`Chat: ${otherPersonName}`} subtitle={order?.code} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.keyboardView}
      >
        {isLoading ? (
          <View style={styles.content}>
            <SkeletonCard />
          </View>
        ) : isError ? (
          <ErrorState message={(error as any)?.message || 'Gagal memuat pesan'} onRetry={() => refetch()} />
        ) : !messages || messages.length === 0 ? (
          <EmptyState
            title="Mulai Percakapan"
            description={`Kirim pesan ke ${otherPersonName} untuk koordinasi penjemputan atau pengantaran.`}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMine = item.senderId === user?.id;

              return (
                <View
                  style={[
                    styles.bubbleContainer,
                    isMine ? styles.myBubbleContainer : styles.otherBubbleContainer,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isMine ? styles.myBubble : styles.otherBubble,
                    ]}
                  >
                    <Text
                      variant="body"
                      color={isMine ? colors.text.inverse : colors.text.primary}
                    >
                      {item.body}
                    </Text>
                    <Text
                      variant="caption"
                      color={isMine ? 'rgba(255,255,255,0.7)' : colors.text.muted}
                      align={isMine ? 'right' : 'left'}
                      style={styles.time}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={`Pesan untuk ${otherPersonName}...`}
            placeholderTextColor={colors.text.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || isSending}
            style={({ pressed }) => [
              styles.sendBtn,
              !input.trim() && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Send size={18} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  messageList: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bubbleContainer: {
    flexDirection: 'row',
  },
  myBubbleContainer: {
    justifyContent: 'flex-end',
  },
  otherBubbleContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radii.xs,
  },
  otherBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  time: {
    marginTop: 2,
    fontSize: 10,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  input: {
    flex: 1,
    ...typography.body,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    color: colors.text.primary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
});

