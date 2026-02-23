import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useBasket } from "@/lib/basket-context";
import { getPriceComparison } from "@/lib/supabase-service";
import { useCity } from "@/lib/city-context";
import { getRTLTextStyle } from "@/lib/rtl-utils";
import { StoreComparison, StoreComparisonItem } from "@/types";

export default function ComparisonScreen() {
  const colors = useColors();
  const router = useRouter();
  const { basket } = useBasket();
  const { selectedCityId, selectedCityName } = useCity();
  const [loading, setLoading] = useState(true);
  const [comparisons, setComparisons] = useState<StoreComparison[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreComparison | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadComparison();
  }, [basket, selectedCityId]);

  const loadComparison = async () => {
    setLoading(true);
    try {
      if (basket.length === 0) {
        setComparisons([]);
        setLoading(false);
        return;
      }

      const itemIds = basket.map((item: any) => item.id);
      const quantities = new Map(basket.map((item: any) => [item.id, item.quantity ?? 1]));
      const results = await getPriceComparison(itemIds, selectedCityId ?? undefined, quantities);
      setComparisons(results);
    } catch (error) {
      console.error("Error loading comparison:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStorePress = (store: StoreComparison) => {
    setSelectedStore(store);
    setModalVisible(true);
  };

  const renderStoreCard = ({ item }: { item: StoreComparison }) => {
    const isCheapest = item.is_cheapest;
    const isComplete = item.is_complete;
    const chainNameStyle = getRTLTextStyle(item.chain_name);
    const branchNameStyle = item.branch_name ? getRTLTextStyle(item.branch_name) : {};

    return (
      <TouchableOpacity
        onPress={() => handleStorePress(item)}
        activeOpacity={0.7}
        className={`rounded-xl p-4 mb-3 border-2 ${
          isCheapest
            ? "bg-success/10 border-success"
            : "bg-surface border-border"
        }`}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text
              className={`text-lg font-bold ${
                isCheapest ? "text-success" : "text-foreground"
              }`}
              style={chainNameStyle}
            >
              {item.chain_name}
            </Text>
            {item.branch_name && (
              <Text
                className="text-sm text-muted mt-1"
                style={branchNameStyle}
              >
                {item.branch_name}
              </Text>
            )}
          </View>

          {isCheapest && (
            <View className="bg-success rounded-full px-3 py-1">
              <Text className="text-white text-xs font-bold">הזול ביותר</Text>
            </View>
          )}
        </View>

        <View className="flex-row justify-between items-center mt-3">
          <View>
            <Text className="text-2xl font-bold text-foreground">
              ₪{item.total_price.toFixed(2)}
            </Text>
            <Text className="text-sm text-muted mt-1">
              {isComplete
                ? `${item.item_count} מוצרים`
                : `${item.item_count - item.missing_items.length} מתוך ${item.item_count} מוצרים`}
            </Text>
          </View>

          <View className="items-end">
            {!isComplete && (
              <View className="flex-row items-center bg-warning/20 rounded-lg px-2 py-1 mb-1">
                <IconSymbol
                  name="xmark"
                  size={14}
                  color={colors.warning}
                />
                <Text className="text-warning text-xs font-semibold ml-1">
                  {item.missing_items.length} חסרים
                </Text>
              </View>
            )}
            <Text className="text-primary text-sm font-semibold">
              פרטים →
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderModal = () => {
    if (!selectedStore) return null;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl max-h-[80%]">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center p-4 border-b border-border">
              <View className="flex-1">
                <Text className="text-xl font-bold text-foreground">
                  {selectedStore.chain_name}
                </Text>
                {selectedStore.branch_name && (
                  <Text className="text-sm text-muted mt-1">
                    {selectedStore.branch_name}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
                className="p-2"
              >
                <IconSymbol
                  name="xmark"
                  size={24}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView className="p-4">
              <View className="bg-surface rounded-xl p-4 mb-4">
                <Text className="text-3xl font-bold text-foreground">
                  ₪{selectedStore.total_price.toFixed(2)}
                </Text>
                <Text className="text-sm text-muted mt-1">
                  {selectedStore.missing_items.length === 0
                    ? `סה"כ עבור ${selectedStore.item_count} מוצרים`
                    : `סה"כ עבור ${selectedStore.item_count - selectedStore.missing_items.length} מתוך ${selectedStore.item_count} מוצרים`}
                </Text>
              </View>

              {/* רשימת מוצרים זמינים */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <Text className="text-foreground font-bold mb-3">
                  מוצרים זמינים ({selectedStore.available_items.length})
                </Text>
                {selectedStore.available_items.map((item: StoreComparisonItem, index: number) => (
                  <View
                    key={index}
                    className={`py-2 ${
                      index < selectedStore.available_items.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text
                        className="text-foreground text-sm flex-1 mr-3"
                        style={getRTLTextStyle(item.name)}
                      >
                        {item.name}
                        {item.quantity > 1 ? `  ×${item.quantity}` : ""}
                      </Text>
                      <View className="items-end">
                        <Text className="text-foreground text-sm font-semibold">
                          ₪{item.price.toFixed(2)}
                        </Text>
                        {item.quantity > 1 && (
                          <Text className="text-muted text-xs">
                            סה"כ ₪{item.line_total.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                    {item.promotion && (
                      <View className="flex-row items-center mt-1 flex-wrap">
                        <Text className="text-primary text-xs">
                          🏷️ {item.promotion.description}
                        </Text>
                        {item.promotion.club_id !== "0" && (
                          <View className="bg-purple-100 rounded px-1.5 py-0.5 ml-2">
                            <Text className="text-purple-700 text-xs font-semibold">מועדון</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {selectedStore.missing_items.length > 0 && (
                <View className="bg-warning/10 rounded-xl p-4 mb-4 border border-warning/30">
                  <View className="flex-row items-center mb-2">
                    <IconSymbol
                      name="xmark"
                      size={20}
                      color={colors.warning}
                    />
                    <Text className="text-warning font-bold ml-2">
                      מוצרים חסרים
                    </Text>
                  </View>
                  <Text className="text-muted text-sm">
                    המוצרים הבאים לא זמינים בחנות זו:
                  </Text>
                  {selectedStore.missing_items.map((item, index) => (
                    <Text
                      key={index}
                      className="text-foreground text-sm mt-2 ml-2"
                      style={getRTLTextStyle(item)}
                    >
                      • {item}
                    </Text>
                  ))}
                  <Text className="text-muted text-xs mt-3">
                    המחיר המוצג הוא חלקי ואינו כולל מוצרים אלו.
                  </Text>
                </View>
              )}

              {selectedStore.is_cheapest && (
                <View className="bg-success/10 rounded-xl p-4 border border-success/30">
                  <Text className="text-success font-bold text-center">
                    🎉 זו האפשרות הזולה ביותר!
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">משווה מחירים...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="mr-3"
        >
          <IconSymbol
            name="chevron.left.forwardslash.chevron.right"
            size={24}
            color={colors.foreground}
          />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-3xl font-bold text-foreground">
            השוואת מחירים
          </Text>
          <Text className="text-base text-muted mt-1">
            {selectedCityName} • לחצו על חנות לפרטים
          </Text>
        </View>
      </View>

      {/* Store Comparison List */}
      {comparisons.length === 0 ? (
        <View className="flex-1 items-center justify-center py-12">
          <IconSymbol
            name="cart"
            size={48}
            color={colors.muted}
          />
          <Text className="text-lg font-semibold text-foreground mt-4">
            הסל ריק
          </Text>
          <Text className="text-base text-muted mt-2 text-center px-4">
            הוסיפו מוצרים מהחיפוש כדי להשוות מחירים
          </Text>
        </View>
      ) : (
        <FlatList
          data={comparisons}
          keyExtractor={(item) => item.store_id.toString()}
          renderItem={renderStoreCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Detail Modal */}
      {renderModal()}
    </ScreenContainer>
  );
}
