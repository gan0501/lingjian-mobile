import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet from './BottomSheet';

export type PileCityItem = { city_code: string; province: string; city: string };
export type PilePriceItem = {
  id: number;
  material_name: string;
  spec_model: string;
  unit: string;
  tax_included_price: number | null;
  tax_excluded_price: number | null;
  year: number;
  month: number;
};

type Props = {
  visible: boolean;
  styles: Record<string, any>;
  marketValue: string;
  cityValue: string;
  cityMenuVisible: boolean;
  cityOptions: PileCityItem[];
  infoPriceLoading?: boolean;
  infoPricePeriod?: string;
  infoPriceList?: PilePriceItem[];
  onChangeMarket: (v: string) => void;
  onOpenCityMenu: () => void;
  onDismissCityMenu: () => void;
  onSelectCity: (city: string, cityCode: string) => void;
  onSelectPriceItem?: (price: string, specModel: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
};

const PriceDialog: React.FC<Props> = ({
  visible,
  marketValue,
  cityValue,
  cityOptions,
  infoPriceLoading,
  infoPricePeriod,
  infoPriceList,
  onChangeMarket,
  onSelectCity,
  onSelectPriceItem,
  onDismiss,
  onConfirm,
}) => {
  const [showCityList, setShowCityList] = React.useState(false);
  const [showPriceList, setShowPriceList] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setShowCityList(false);
      setShowPriceList(false);
    }
  }, [visible]);

  // Group cities by province
  const provinceGroups = React.useMemo(() => {
    const map = new Map<string, PileCityItem[]>();
    (cityOptions || []).forEach((c) => {
      const prov = c.province || '其他';
      if (!map.has(prov)) map.set(prov, []);
      map.get(prov)!.push(c);
    });
    return Array.from(map.entries()).map(([province, cities]) => ({ province, cities }));
  }, [cityOptions]);

  const footer = (
    <View style={s.footerRow}>
      <TouchableOpacity style={s.cancelBtn} onPress={onDismiss} activeOpacity={0.8}>
        <Text style={s.cancelText}>取消</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
        <Text style={s.confirmText}>确认</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheet visible={visible} title="桩单价" onDismiss={onDismiss} footer={footer}>
      <Text style={s.desc}>选择使用市场价或信息价</Text>
      <View style={{ height: 14 }} />

      <View style={{ gap: 14 }}>
        {/* 市场价 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>市场价</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="请输入"
              placeholderTextColor="rgba(0,0,0,0.35)"
              keyboardType="numeric"
              value={marketValue}
              onChangeText={onChangeMarket}
            />
            <Text style={s.suffix}>元/m</Text>
          </View>
        </View>

        {/* 信息价 */}
        <View style={{ gap: 6 }}>
          <Text style={s.label}>信息价</Text>
          <TouchableOpacity
            style={s.dropdownBtn}
            activeOpacity={0.7}
            onPress={() => {
              setShowCityList(!showCityList);
              if (showPriceList) setShowPriceList(false);
            }}
          >
            <Text style={[s.dropdownText, !cityValue && s.dropdownPlaceholder]}>
              {cityValue || '选择城市'}
            </Text>
            <Text style={s.arrow}>{showCityList ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showCityList && (
            <ScrollView style={s.cityScroll} nestedScrollEnabled>
              {provinceGroups.map((group) => (
                <View key={group.province}>
                  <Text style={s.provinceName}>{group.province}</Text>
                  <View style={s.cityChipsRow}>
                    {group.cities.map((c) => (
                      <TouchableOpacity
                        key={c.city_code}
                        style={[s.cityChip, cityValue === c.city && s.cityChipSelected]}
                        activeOpacity={0.7}
                        onPress={() => {
                          onSelectCity(c.city, c.city_code);
                          setShowCityList(false);
                          setShowPriceList(true);
                        }}
                      >
                        <Text style={[s.cityChipText, cityValue === c.city && s.cityChipTextSelected]}>
                          {c.city}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* 信息价结果 */}
          {infoPriceLoading && (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color="#B20000" />
              <Text style={s.loadingText}>正在查询信息价...</Text>
            </View>
          )}

          {!infoPriceLoading && infoPricePeriod && cityValue && (
            <View style={{ gap: 6 }}>
              <Text style={s.periodTag}>{cityValue} · {infoPricePeriod}</Text>

              {infoPriceList && infoPriceList.length > 0 ? (
                <>
                  <TouchableOpacity
                    style={s.dropdownBtn}
                    activeOpacity={0.7}
                    onPress={() => setShowPriceList(!showPriceList)}
                  >
                    <Text style={s.dropdownText}>
                      选择桩型查看价格 ({infoPriceList.length}条)
                    </Text>
                    <Text style={s.arrow}>{showPriceList ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {showPriceList && (
                    <ScrollView style={s.priceScroll} nestedScrollEnabled>
                      {infoPriceList.map((item) => {
                        const price = item.tax_included_price;
                        const priceStr = price != null ? Number(price).toFixed(2) : '--';
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={s.priceRow}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (price != null && onSelectPriceItem) {
                                onSelectPriceItem(String(Math.round(price)), item.spec_model);
                              }
                              setShowPriceList(false);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={s.priceItemName} numberOfLines={1}>{item.material_name}</Text>
                              <Text style={s.priceItemSpec} numberOfLines={1}>{item.spec_model} · {item.unit}</Text>
                            </View>
                            <Text style={s.priceItemPrice}>{priceStr}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </>
              ) : (
                <Text style={s.noDataText}>该城市暂无桩基信息价数据</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </BottomSheet>
  );
};

const s = StyleSheet.create({
  desc: { fontSize: 12, color: 'rgba(0,0,0,0.4)' },
  label: { fontSize: 12, fontWeight: '700', color: '#111' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    height: 40,
  },
  input: { flex: 1, fontSize: 13, color: '#111', padding: 0 },
  suffix: { fontSize: 13, color: '#999', marginLeft: 6 },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#fff',
  },
  dropdownText: { flex: 1, fontSize: 13, color: '#333' },
  dropdownPlaceholder: { color: 'rgba(0,0,0,0.35)' },
  arrow: { fontSize: 10, color: 'rgba(0,0,0,0.3)' },
  cityScroll: { maxHeight: 220, borderRadius: 8, backgroundColor: '#F8F8F8' },
  provinceName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  cityChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 6,
    paddingBottom: 6,
  },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#EFEFEF',
  },
  cityChipSelected: { backgroundColor: 'rgba(178,0,0,0.1)' },
  cityChipText: { fontSize: 12, color: '#555' },
  cityChipTextSelected: { color: '#B20000', fontWeight: '600' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: { fontSize: 12, color: '#999' },
  periodTag: {
    fontSize: 11,
    color: '#B20000',
    fontWeight: '600',
    paddingVertical: 2,
  },
  priceScroll: { maxHeight: 200, borderRadius: 8, backgroundColor: '#FAFAFA' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  priceItemName: { fontSize: 12, color: '#333', fontWeight: '500' },
  priceItemSpec: { fontSize: 11, color: '#999', marginTop: 2 },
  priceItemPrice: { fontSize: 14, fontWeight: '700', color: '#B20000', marginLeft: 8 },
  noDataText: { fontSize: 12, color: '#999', paddingVertical: 6 },
  footerRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: '#666' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#B20000',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: { fontSize: 14, color: '#FFF' },
});

export default PriceDialog;
