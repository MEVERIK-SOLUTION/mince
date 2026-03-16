import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
  filters?: any;
}

interface SearchHistoryProps {
  onSearchSelect: (query: string, filters?: any) => void;
  onClose: () => void;
  maxItems?: number;
}

const STORAGE_KEY = 'search_history';
const DEFAULT_MAX_ITEMS = 50;

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  onSearchSelect,
  onClose,
  maxItems = DEFAULT_MAX_ITEMS
}) => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupedHistory, setGroupedHistory] = useState<{ [key: string]: SearchHistoryItem[] }>({});

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    groupHistoryByDate();
  }, [history]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const historyData = JSON.parse(stored).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setHistory(historyData.sort((a: SearchHistoryItem, b: SearchHistoryItem) => 
          b.timestamp.getTime() - a.timestamp.getTime()
        ));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveHistory = async (newHistory: SearchHistoryItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  const groupHistoryByDate = () => {
    const groups: { [key: string]: SearchHistoryItem[] } = {};
    const now = new Date();
    
    history.forEach(item => {
      const itemDate = item.timestamp;
      const diffMs = now.getTime() - itemDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      let groupKey: string;
      if (diffDays === 0) {
        groupKey = 'Dnes';
      } else if (diffDays === 1) {
        groupKey = 'Včera';
      } else if (diffDays < 7) {
        groupKey = 'Tento týden';
      } else if (diffDays < 30) {
        groupKey = 'Tento měsíc';
      } else {
        groupKey = 'Starší';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });
    
    setGroupedHistory(groups);
  };

  const addToHistory = useCallback(async (query: string, resultCount: number, filters?: any) => {
    if (!query.trim()) return;

    // Zkontrolovat, zda už existuje stejný dotaz
    const existingIndex = history.findIndex(item => 
      item.query.toLowerCase() === query.toLowerCase() &&
      JSON.stringify(item.filters) === JSON.stringify(filters)
    );

    let newHistory: SearchHistoryItem[];
    
    if (existingIndex >= 0) {
      // Aktualizovat existující záznam
      const updatedItem = {
        ...history[existingIndex],
        timestamp: new Date(),
        resultCount
      };
      newHistory = [
        updatedItem,
        ...history.filter((_, index) => index !== existingIndex)
      ];
    } else {
      // Přidat nový záznam
      const newItem: SearchHistoryItem = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: new Date(),
        resultCount,
        filters
      };
      newHistory = [newItem, ...history];
    }

    // Omezit počet záznamů
    if (newHistory.length > maxItems) {
      newHistory = newHistory.slice(0, maxItems);
    }

    setHistory(newHistory);
    await saveHistory(newHistory);
  }, [history, maxItems]);

  const removeFromHistory = useCallback(async (itemId: string) => {
    const newHistory = history.filter(item => item.id !== itemId);
    setHistory(newHistory);
    await saveHistory(newHistory);
  }, [history]);

  const clearHistory = useCallback(async () => {
    Alert.alert(
      'Vymazat historii',
      'Opravdu chcete vymazat celou historii vyhledávání?',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Vymazat',
          style: 'destructive',
          onPress: async () => {
            setHistory([]);
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      ]
    );
  }, []);

  const handleItemPress = useCallback((item: SearchHistoryItem) => {
    onSearchSelect(item.query, item.filters);
  }, [onSearchSelect]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('cs-CZ', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getFilterSummary = (filters?: any) => {
    if (!filters || Object.keys(filters).length === 0) return null;
    
    const parts = [];
    if (filters.country) parts.push(filters.country);
    if (filters.material) parts.push(filters.material);
    if (filters.yearFrom && filters.yearTo) {
      parts.push(`${filters.yearFrom}-${filters.yearTo}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  const renderHistoryItem = ({ item }: { item: SearchHistoryItem }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleItemPress(item)}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.itemQuery}>{item.query}</Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeFromHistory(item.id)}
          >
            <Ionicons name="close" size={16} color="#999" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.itemMeta}>
          <Text style={styles.itemTime}>{formatTime(item.timestamp)}</Text>
          <Text style={styles.itemResults}>
            {item.resultCount} výsledků
          </Text>
        </View>
        
        {getFilterSummary(item.filters) && (
          <Text style={styles.itemFilters}>
            Filtry: {getFilterSummary(item.filters)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderGroup = (groupKey: string, items: SearchHistoryItem[]) => (
    <View key={groupKey} style={styles.group}>
      <Text style={styles.groupTitle}>{groupKey}</Text>
      {items.map(item => (
        <View key={item.id}>
          {renderHistoryItem({ item })}
        </View>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Historie vyhledávání</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Načítání...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historie vyhledávání</Text>
        <View style={styles.headerButtons}>
          {history.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearHistory}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>Žádná historie</Text>
          <Text style={styles.emptyText}>
            Vaše vyhledávání se budou zobrazovat zde
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {Object.entries(groupedHistory).map(([groupKey, items]) =>
            renderGroup(groupKey, items)
          )}
        </ScrollView>
      )}
    </View>
  );
};

// Hook pro správu historie vyhledávání
export const useSearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  const addToHistory = useCallback(async (query: string, resultCount: number, filters?: any) => {
    if (!query.trim()) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const currentHistory = stored ? JSON.parse(stored) : [];
      
      // Zkontrolovat duplicity
      const existingIndex = currentHistory.findIndex((item: any) => 
        item.query.toLowerCase() === query.toLowerCase() &&
        JSON.stringify(item.filters) === JSON.stringify(filters)
      );

      let newHistory: SearchHistoryItem[];
      
      if (existingIndex >= 0) {
        // Aktualizovat existující
        const updatedItem = {
          ...currentHistory[existingIndex],
          timestamp: new Date().toISOString(),
          resultCount
        };
        newHistory = [
          updatedItem,
          ...currentHistory.filter((_: any, index: number) => index !== existingIndex)
        ];
      } else {
        // Přidat nový
        const newItem: SearchHistoryItem = {
          id: Date.now().toString(),
          query: query.trim(),
          timestamp: new Date(),
          resultCount,
          filters
        };
        newHistory = [newItem, ...currentHistory];
      }

      // Omezit na 50 záznamů
      if (newHistory.length > 50) {
        newHistory = newHistory.slice(0, 50);
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error('Error adding to search history:', error);
    }
  }, []);

  const getRecentSearches = useCallback(async (limit: number = 10) => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const historyData = JSON.parse(stored);
        return historyData.slice(0, limit).map((item: any) => item.query);
      }
      return [];
    } catch (error) {
      console.error('Error getting recent searches:', error);
      return [];
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setHistory([]);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, []);

  return {
    history,
    addToHistory,
    getRecentSearches,
    clearHistory
  };
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  historyItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemQuery: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  removeButton: {
    padding: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTime: {
    fontSize: 12,
    color: '#999',
  },
  itemResults: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  itemFilters: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default SearchHistory;