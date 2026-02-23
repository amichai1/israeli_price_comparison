import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useBasket } from "@/lib/basket-context";
import { getRTLTextStyle } from "@/lib/rtl-utils";
import { BasketItem } from "@/types";

export default function BasketScreen() {
  const colors = useColors();
  const router = useRouter();
  const { basket, loading, removeItem, clearItems } = useBasket();

  const handleRemoveItem = async (itemId: number) => {
    try {
      await removeItem(itemId);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Error removing item:", error);
    }
  };

  const handleClearBasket = () => {
    Alert.alert(
      "ניקוי סל",
      "בטוח שברצונך להסיר את כל המוצרים?",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "נקה",
          style: "destructive",
          onPress: async () => {
            await clearItems();

            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  const handleCompare = () => {
    if (basket.length === 0) {
      Alert.alert("סל ריק", "יש להוסיף מוצרים לסל תחילה.");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Navigate to comparison screen
    router.push("/(tabs)/comparison" as any);
  };

  const renderItem = ({ item }: { item: BasketItem }) => {
    const nameStyle = getRTLTextStyle(item.name);

    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text
              className="text-base font-semibold text-foreground mb-1"
              style={nameStyle}
            >
              {item.name}
            </Text>
            <Text className="text-sm text-muted">
              ברקוד: {item.barcode}
            </Text>
            {item.unit_measure && (
              <Text className="text-sm text-muted">
                יחידה: {item.unit_measure}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => handleRemoveItem(item.id)}
            activeOpacity={0.6}
            className="p-2"
          >
            <IconSymbol
              name="trash.fill"
              size={20}
              color={colors.error}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <IconSymbol
          name="cart.fill"
          size={64}
          color={colors.muted}
        />
        <Text className="text-lg text-muted mt-4 text-center">
          הסל ריק
        </Text>
        <Text className="text-sm text-muted mt-2 text-center px-8">
          חפשו מוצרים והוסיפו לסל כדי להשוות מחירים
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-3xl font-bold text-foreground mb-1">
            הסל שלי
          </Text>
          <Text className="text-base text-muted">
            {basket.length} {basket.length === 1 ? "מוצר" : "מוצרים"}
          </Text>
        </View>

        {basket.length > 0 && (
          <TouchableOpacity
            onPress={handleClearBasket}
            activeOpacity={0.7}
            className="px-3 py-2"
          >
            <Text className="text-error font-semibold">נקה הכל</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Basket Items */}
      <FlatList
        data={basket}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      />

      {/* Compare Button */}
      {basket.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <TouchableOpacity
            onPress={handleCompare}
            activeOpacity={0.8}
            className="bg-primary rounded-xl py-4 items-center"
          >
            <Text className="text-white text-lg font-bold">
              השווה מחירים
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}
