import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';

interface SearchFilters {
  query: string;
  country: string;
  period: string;
  material: string;
  denomination: string;
  condition: string;
  yearFrom: number;
  yearTo: number;
  priceFrom: number;
  priceTo: number;
  diameter: number;
  weight: number;
  hasImage: boolean;
  inCollection: boolean;
  inWishlist: boolean;
  rarity: string;
  mintage: string;
  category: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onClose: () => void;
  initialFilters?: Partial<SearchFilters>;
}

const defaultFilters: SearchFilters = {
  query: '',
  country: '',
  period: '',
  material: '',
  denomination: '',
  condition: '',
  yearFrom: 1800,
  yearTo: new Date().getFullYear(),
  priceFrom: 0,
  priceTo: 10000,
  diameter: 0,
  weight: 0,
  hasImage: false,
  inCollection: false,
  inWishlist: false,
  rarity: '',
  mintage: '',
  category: ''
};

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onClose,
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    ...initialFilters
  });

  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    location: false,
    physical: false,
    value: false,
    status: false,
    advanced: false
  });

  const countries = useMemo(() => [
    { label: 'Všechny země', value: '' },
    { label: 'Česká republika', value: 'CZ' },
    { label: 'Slovensko', value: 'SK' },
    { label: 'Německo', value: 'DE' },
    { label: 'Rakousko', value: 'AT' },
    { label: 'USA', value: 'US' },
    { label: 'Velká Británie', value: 'GB' },
    { label: 'Francie', value: 'FR' },
    { label: 'Itálie', value: 'IT' },
    { label: 'Španělsko', value: 'ES' },
    { label: 'Rusko', value: 'RU' },
    { label: 'Čína', value: 'CN' },
    { label: 'Japonsko', value: 'JP' }
  ], []);

  const periods = useMemo(() => [
    { label: 'Všechna období', value: '' },
    { label: 'Antika (do 476)', value: 'ancient' },
    { label: 'Středověk (476-1453)', value: 'medieval' },
    { label: 'Raný novověk (1453-1789)', value: 'early_modern' },
    { label: '19. století (1800-1899)', value: '19th_century' },
    { label: '20. století (1900-1999)', value: '20th_century' },
    { label: '21. století (2000-)', value: '21st_century' }
  ], []);

  const materials = useMemo(() => [
    { label: 'Všechny materiály', value: '' },
    { label: 'Zlato', value: 'gold' },
    { label: 'Stříbro', value: 'silver' },
    { label: 'Měď', value: 'copper' },
    { label: 'Bronz', value: 'bronze' },
    { label: 'Nikl', value: 'nickel' },
    { label: 'Zinek', value: 'zinc' },
    { label: 'Hliník', value: 'aluminum' },
    { label: 'Bimetalická', value: 'bimetallic' },
    { label: 'Platina', value: 'platinum' },
    { label: 'Palladium', value: 'palladium' }
  ], []);

  const conditions = useMemo(() => [
    { label: 'Všechny stavy', value: '' },
    { label: 'Perfektní (MS-70)', value: 'MS-70' },
    { label: 'Téměř perfektní (MS-69)', value: 'MS-69' },
    { label: 'Vynikající (MS-65)', value: 'MS-65' },
    { label: 'Velmi dobrý (MS-60)', value: 'MS-60' },
    { label: 'Dobrý (AU-50)', value: 'AU-50' },
    { label: 'Velmi jemný (VF-20)', value: 'VF-20' },
    { label: 'Jemný (F-12)', value: 'F-12' },
    { label: 'Dobrý (G-4)', value: 'G-4' },
    { label: 'Poškozený', value: 'damaged' }
  ], []);

  const rarities = useMemo(() => [
    { label: 'Všechny vzácnosti', value: '' },
    { label: 'Běžná', value: 'common' },
    { label: 'Neobvyklá', value: 'uncommon' },
    { label: 'Vzácná', value: 'rare' },
    { label: 'Velmi vzácná', value: 'very_rare' },
    { label: 'Extrémně vzácná', value: 'extremely_rare' },
    { label: 'Unikátní', value: 'unique' }
  ], []);

  const categories = useMemo(() => [
    { label: 'Všechny kategorie', value: '' },
    { label: 'Oběžné mince', value: 'circulation' },
    { label: 'Pamětní mince', value: 'commemorative' },
    { label: 'Investiční mince', value: 'bullion' },
    { label: 'Sběratelské mince', value: 'collectible' },
    { label: 'Antické mince', value: 'ancient' },
    { label: 'Středověké mince', value: 'medieval' },
    { label: 'Koloniální mince', value: 'colonial' },
    { label: 'Vojenské mince', value: 'military' },
    { label: 'Regionální mince', value: 'regional' }
  ], []);

  const updateFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const handleSearch = useCallback(() => {
    onSearch(filters);
  }, [filters, onSearch]);

  const renderSection = (
    title: string,
    sectionKey: keyof typeof expandedSections,
    children: React.ReactNode
  ) => (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(sectionKey)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons
          name={expandedSections[sectionKey] ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#666"
        />
      </TouchableOpacity>
      {expandedSections[sectionKey] && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pokročilé vyhledávání</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Základní vyhledávání */}
        {renderSection('Základní vyhledávání', 'basic', (
          <View>
            <Text style={styles.label}>Hledaný text</Text>
            <TextInput
              style={styles.textInput}
              value={filters.query}
              onChangeText={(text) => updateFilter('query', text)}
              placeholder="Název, popis, katalogové číslo..."
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Kategorie</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.category}
                onValueChange={(value) => updateFilter('category', value)}
                style={styles.picker}
              >
                {categories.map(item => (
                  <Picker.Item key={item.value} label={item.label} value={item.value} />
                ))}
              </Picker>
            </View>
          </View>
        ))}

        {/* Lokace a období */}
        {renderSection('Lokace a období', 'location', (
          <View>
            <Text style={styles.label}>Země původu</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.country}
                onValueChange={(value) => updateFilter('country', value)}
                style={styles.picker}
              >
                {countries.map(item => (
                  <Picker.Item key={item.value} label={item.label} value={item.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Historické období</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.period}
                onValueChange={(value) => updateFilter('period', value)}
                style={styles.picker}
              >
                {periods.map(item => (
                  <Picker.Item key={item.value} label={item.label} value={item.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Rok vydání</Text>
            <View style={styles.rangeContainer}>
              <View style={styles.rangeInput}>
                <Text style={styles.rangeLabel}>Od: {filters.yearFrom}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1800}
                  maximumValue={new Date().getFullYear()}
                  value={filters.yearFrom}
                  onValueChange={(value) => updateFilter('yearFrom', Math.round(value))}
                  step={1}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#E0E0E0"
                  thumbStyle={styles.sliderThumb}
                />
              </View>
              <View style={styles.rangeInput}>
                <Text style={styles.rangeLabel}>Do: {filters.yearTo}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1800}
                  maximumValue={new Date().getFullYear()}
                  value={filters.yearTo}
                  onValueChange={(value) => updateFilter('yearTo', Math.round(value))}
                  step={1}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#E0E0E0"
                  thumbStyle={styles.sliderThumb}
                />
              </View>
            </View>
          </View>
        ))}

        {/* Fyzické vlastnosti */}
        {renderSection('Fyzické vlastnosti', 'physical', (
          <View>
            <Text style={styles.label}>Materiál</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.material}
                onValueChange={(value) => updateFilter('material', value)}
                style={styles.picker}
              >
                {materials.map(item => (
                  <Picker.Item key={item.value} label={item.label} value={item.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Stav zachování</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.condition}
                onValueChange={(value) => updateFilter('condition', value)}
                style={styles.picker}
              >
                {conditions.map(item => (
                  <Picker.Item key={item.value} label={item.label} value={item.value} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Průměr (mm): {filters.diameter || 'Jakýkoliv'}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={50}
              value={filters.diameter}
              onValueChange={(value) => updateFilter('diameter', Math.round(value))}
              step={1}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#E0E0E0"
              thumbStyle={styles.sliderThumb}
            />

            <Text style={styles.label}>Hmotnost (g): {filters.weight || 'Jakákoliv'}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              value={filters.weight}
              onValueChange={(value) => updateFilter('weight', Math.round(value * 10) / 10)}
              step={0.1}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#E0E0E0"
              thumbStyle={styles.sliderThumb}
            />
          </View>
        ))}

        {/* Hodnota */}
        {renderSection('Hodnota', 'value', (
          <View>
            <Text style={styles.label}>Cenové rozpětí (Kč)</Text>
            <View style={styles.rangeContainer}>
              <View style={styles.rangeInput}>
                <Text style={styles.rangeLabel}>Od: {filters.priceFrom} Kč</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={10000}
                  value={filters.priceFrom}
                  onValueChange={(value) => updateFilter('priceFrom', Math.round(value))}
                  step={10}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#E0E0E0"
                  thumbStyle={styles.sliderThumb}
                />
              </View>
              <View style={styles.rangeInput}>
                <Text style={styles.rangeLabel}>Do: {filters.priceTo} Kč</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={10000}
                  value={filters.priceTo}
                  onValueChange={(value) => updateFilter('priceTo', Math.round(value))}
                  step={10}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#E0E0E0"
                  thumbStyle={styles.sliderThumb}
                />
              </View>
            </View>

            <Text style={styles.label}>Vzácnost</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={filters.rarity}
                onValueChange={(value) => updateFilter('rarity', value)}
                style={styles.picker}
              >
                {rarities.map(item => (
                  <Picker.Item key={item.value} label={item.label} value={item.value} />
                ))}
              </Picker>
            </View>
          </View>
        ))}

        {/* Stav v kolekci */}
        {renderSection('Stav v kolekci', 'status', (
          <View>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => updateFilter('hasImage', !filters.hasImage)}
            >
              <Ionicons
                name={filters.hasImage ? 'checkbox' : 'square-outline'}
                size={24}
                color="#007AFF"
              />
              <Text style={styles.checkboxLabel}>Pouze s fotografií</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => updateFilter('inCollection', !filters.inCollection)}
            >
              <Ionicons
                name={filters.inCollection ? 'checkbox' : 'square-outline'}
                size={24}
                color="#007AFF"
              />
              <Text style={styles.checkboxLabel}>V mé kolekci</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => updateFilter('inWishlist', !filters.inWishlist)}
            >
              <Ionicons
                name={filters.inWishlist ? 'checkbox' : 'square-outline'}
                size={24}
                color="#007AFF"
              />
              <Text style={styles.checkboxLabel}>V seznamu přání</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={resetFilters}
        >
          <Text style={styles.resetButtonText}>Vymazat filtry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.searchButton]}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Vyhledat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  picker: {
    height: 50,
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  rangeInput: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: '#007AFF',
    width: 20,
    height: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  resetButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: '#007AFF',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdvancedSearch;