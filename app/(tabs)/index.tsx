import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { searchProducts } from "@/lib/supabase-service";
import { useBasket } from "@/lib/basket-context";
import { useCity } from "@/lib/city-context";
import { getRTLTextStyle } from "@/lib/rtl-utils";
import { Item } from "@/types";

export default function SearchScreen() {
  const colors = useColors();
  const { selectedCityId, selectedCityName, setSelectedCity, availableCities } = useCity();
  const { basket, addItem, removeItem, isInBasket } = useBasket();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  // Load basket count on mount
  useEffect(() => {
    loadAddedItems();
  }, []);

  const loadAddedItems = async () => {
    // This will use the basket from context, which auto-updates
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        performSearch(searchQuery);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setLoading(true);
    try {
      const items = await searchProducts(query);
      setResults(items);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBasket = async (item: Item) => {
    try {
      await addItem(item);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Error adding to basket:", error);
    }
  };

  const handleRemoveFromBasket = async (itemId: number) => {
    try {
      await removeItem(itemId);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Error removing from basket:", error);
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const itemInBasket = isInBasket(item.id);
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
            onPress={() => itemInBasket ? handleRemoveFromBasket(item.id) : handleAddToBasket(item)}
            activeOpacity={0.7}
            className={`px-4 py-2 rounded-lg ${
              itemInBasket ? "bg-error" : "bg-primary"
            }`}
          >
            {itemInBasket ? (
              <Text className="text-white font-semibold text-sm">הסר</Text>
            ) : (
              <Text className="text-white font-semibold text-sm">הוסף</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    if (searchQuery.trim().length === 0) {
      return (
        <View className="items-center justify-center py-12">
          <IconSymbol
            name="magnifyingglass"
            size={64}
            color={colors.muted}
          />
          <Text className="text-lg text-muted mt-4 text-center">
            חפשו מוצרים לפי שם או ברקוד
          </Text>
        </View>
      );
    }

    return (
      <View className="items-center justify-center py-12">
        <Text className="text-lg text-muted text-center">
          לא נמצאו מוצרים עבור "{searchQuery}"
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      {/* Header */}
      <View className="mb-4 flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-3xl font-bold text-foreground mb-2">
            חיפוש מוצרים
          </Text>
          <Text className="text-base text-muted">
            חפשו מוצרים והשוו מחירים בין הרשתות
          </Text>
        </View>

        {basket.length > 0 && (
          <View className="bg-primary rounded-full px-3 py-2 ml-3">
            <Text className="text-white font-bold text-lg">
              {basket.length}
            </Text>
          </View>
        )}
      </View>

      {/* City Selector */}
      <View className="mb-4" style={{ zIndex: 10 }}>
        <Text className="text-sm font-semibold text-foreground mb-2">עיר</Text>
        <TouchableOpacity
          onPress={() => setShowCityPicker(!showCityPicker)}
          activeOpacity={0.7}
          className="bg-surface border border-border rounded-xl px-4 py-3 flex-row justify-between items-center"
        >
          <Text className="text-foreground font-medium">{selectedCityName}</Text>
          <IconSymbol
            name={showCityPicker ? "chevron.up" : "chevron.down"}
            size={20}
            color={colors.foreground}
          />
        </TouchableOpacity>

        {showCityPicker && (
          <View
            className="mt-2 bg-surface border border-border rounded-xl overflow-hidden"
            style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20 }}
          >
            {availableCities.map((city) => (
              <TouchableOpacity
                key={city.id}
                onPress={() => {
                  setSelectedCity(city);
                  setShowCityPicker(false);
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                activeOpacity={0.7}
                className={`px-4 py-3 border-b border-border ${
                  city.id === selectedCityId ? "bg-primary/10" : ""
                }`}
              >
                <Text
                  className={`font-medium ${
                    city.id === selectedCityId ? "text-primary" : "text-foreground"
                  }`}
                >
                  {city.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View className="relative mb-6">
        <View className="absolute left-3 top-3 z-10">
          <IconSymbol
            name="magnifyingglass"
            size={20}
            color={colors.muted}
          />
        </View>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="חיפוש לפי שם או ברקוד..."
          placeholderTextColor={colors.muted}
          className="bg-surface border border-border rounded-xl pl-10 pr-8 py-3.5 text-foreground"
          returnKeyType="search"
          style={getRTLTextStyle(searchQuery)}
        />
      </View>

      {/* Results List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </ScreenContainer>
  );
}
