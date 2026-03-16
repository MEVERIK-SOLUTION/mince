import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'suggestion' | 'coin' | 'country' | 'category';
  count?: number;
  icon?: string;
  metadata?: {
    country?: string;
    year?: number;
    material?: string;
    category?: string;
  };
}

interface SearchSuggestionsProps {
  query: string;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onQueryChange: (query: string) => void;
  recentSearches: string[];
  popularSearches: string[];
  visible: boolean;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  onSuggestionSelect,
  onQueryChange,
  recentSearches,
  popularSearches,
  visible
}) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Simulovaná data pro návrhy
  const coinSuggestions = useMemo(() => [
    {
      id: '1',
      text: '10 Kč 1993',
      type: 'coin' as const,
      icon: 'disc',
      metadata: { country: 'CZ', year: 1993, material: 'bronze' }
    },
    {
      id: '2',
      text: '1 Dollar 2020',
      type: 'coin' as const,
      icon: 'disc',
      metadata: { country: 'US', year: 2020, material: 'silver' }
    },
    {
      id: '3',
      text: '2 Euro 2002',
      type: 'coin' as const,
      icon: 'disc',
      metadata: { country: 'DE', year: 2002, material: 'bimetallic' }
    },
    {
      id: '4',
      text: '50 Haléřů 1947',
      type: 'coin' as const,
      icon: 'disc',
      metadata: { country: 'CZ', year: 1947, material: 'aluminum' }
    }
  ], []);

  const countrySuggestions = useMemo(() => [
    { id: 'cz', text: 'Česká republika', type: 'country' as const, icon: 'flag', count: 245 },
    { id: 'us', text: 'USA', type: 'country' as const, icon: 'flag', count: 189 },
    { id: 'de', text: 'Německo', type: 'country' as const, icon: 'flag', count: 156 },
    { id: 'gb', text: 'Velká Británie', type: 'country' as const, icon: 'flag', count: 134 },
    { id: 'fr', text: 'Francie', type: 'country' as const, icon: 'flag', count: 98 }
  ], []);

  const categorySuggestions = useMemo(() => [
    { id: 'commemorative', text: 'Pamětní mince', type: 'category' as const, icon: 'star', count: 78 },
    { id: 'circulation', text: 'Oběžné mince', type: 'category' as const, icon: 'refresh', count: 234 },
    { id: 'bullion', text: 'Investiční mince', type: 'category' as const, icon: 'trending-up', count: 45 },
    { id: 'ancient', text: 'Antické mince', type: 'category' as const, icon: 'library', count: 23 }
  ], []);

  // Generování návrhů na základě dotazu
  const generateSuggestions = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    
    try {
      const normalizedQuery = searchQuery.toLowerCase().trim();
      const newSuggestions: SearchSuggestion[] = [];

      if (normalizedQuery === '') {
        // Zobrazit nedávné a populární vyhledávání
        const recentSuggestions = recentSearches.slice(0, 5).map((search, index) => ({
          id: `recent-${index}`,
          text: search,
          type: 'recent' as const,
          icon: 'time'
        }));

        const popularSuggestionsList = popularSearches.slice(0, 5).map((search, index) => ({
          id: `popular-${index}`,
          text: search,
          type: 'popular' as const,
          icon: 'trending-up'
        }));

        newSuggestions.push(...recentSuggestions, ...popularSuggestionsList);
      } else {
        // Filtrovat mince podle dotazu
        const matchingCoins = coinSuggestions.filter(coin =>
          coin.text.toLowerCase().includes(normalizedQuery)
        );

        // Filtrovat země podle dotazu
        const matchingCountries = countrySuggestions.filter(country =>
          country.text.toLowerCase().includes(normalizedQuery)
        );

        // Filtrovat kategorie podle dotazu
        const matchingCategories = categorySuggestions.filter(category =>
          category.text.toLowerCase().includes(normalizedQuery)
        );

        // Přidat textové návrhy
        const textSuggestions = [
          `"${searchQuery}" v názvu`,
          `"${searchQuery}" v popisu`,
          `"${searchQuery}" v katalogových číslech`
        ].map((text, index) => ({
          id: `text-${index}`,
          text,
          type: 'suggestion' as const,
          icon: 'search'
        }));

        newSuggestions.push(
          ...matchingCoins,
          ...matchingCountries,
          ...matchingCategories,
          ...textSuggestions.slice(0, 3)
        );
      }

      setSuggestions(newSuggestions.slice(0, 10));
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [recentSearches, popularSearches, coinSuggestions, countrySuggestions, categorySuggestions]);

  useEffect(() => {
    if (visible) {
      generateSuggestions(query);
    }
  }, [query, visible, generateSuggestions]);

  const handleSuggestionPress = useCallback((suggestion: SearchSuggestion) => {
    onSuggestionSelect(suggestion);
  }, [onSuggestionSelect]);

  const getIconName = (type: string, icon?: string) => {
    if (icon) return icon;
    
    switch (type) {
      case 'recent':
        return 'time';
      case 'popular':
        return 'trending-up';
      case 'coin':
        return 'disc';
      case 'country':
        return 'flag';
      case 'category':
        return 'folder';
      default:
        return 'search';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'recent':
        return 'Nedávné';
      case 'popular':
        return 'Populární';
      case 'coin':
        return 'Mince';
      case 'country':
        return 'Země';
      case 'category':
        return 'Kategorie';
      default:
        return '';
    }
  };

  const renderSuggestion = ({ item }: { item: SearchSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
    >
      <View style={styles.suggestionContent}>
        <Ionicons
          name={getIconName(item.type, item.icon) as any}
          size={20}
          color="#666"
          style={styles.suggestionIcon}
        />
        
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionTitle}>{item.text}</Text>
          {item.metadata && (
            <Text style={styles.suggestionMetadata}>
              {item.metadata.country && `${item.metadata.country} • `}
              {item.metadata.year && `${item.metadata.year} • `}
              {item.metadata.material && item.metadata.material}
            </Text>
          )}
          {item.count && (
            <Text style={styles.suggestionCount}>
              {item.count} výsledků
            </Text>
          )}
        </View>

        <View style={styles.suggestionMeta}>
          {item.type !== 'suggestion' && (
            <Text style={styles.typeLabel}>{getTypeLabel(item.type)}</Text>
          )}
          <Ionicons name="arrow-up-outline" size={16} color="#999" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const groupedSuggestions = useMemo(() => {
    const groups: { [key: string]: SearchSuggestion[] } = {};
    
    suggestions.forEach(suggestion => {
      const key = suggestion.type;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(suggestion);
    });

    return groups;
  }, [suggestions]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={suggestions}
        renderItem={renderSuggestion}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          query === '' ? (
            <View style={styles.header}>
              <Text style={styles.headerText}>
                {recentSearches.length > 0 ? 'Nedávné a populární vyhledávání' : 'Populární vyhledávání'}
              </Text>
            </View>
          ) : (
            <View style={styles.header}>
              <Text style={styles.headerText}>Návrhy pro "{query}"</Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginTop: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 400,
  },
  list: {
    maxHeight: 400,
  },
  header: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  suggestionMetadata: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  suggestionCount: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  suggestionMeta: {
    alignItems: 'flex-end',
  },
  typeLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 48,
  },
  sectionHeader: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
});

export default SearchSuggestions;