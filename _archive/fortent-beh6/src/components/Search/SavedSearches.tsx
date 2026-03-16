import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: any;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  resultCount?: number;
}

interface SavedSearchesProps {
  onSearchSelect: (search: SavedSearch) => void;
  onClose: () => void;
  currentQuery?: string;
  currentFilters?: any;
}

const STORAGE_KEY = 'saved_searches';

export const SavedSearches: React.FC<SavedSearchesProps> = ({
  onSearchSelect,
  onClose,
  currentQuery = '',
  currentFilters = {}
}) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');

  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const searches = JSON.parse(stored).map((search: any) => ({
          ...search,
          createdAt: new Date(search.createdAt),
          lastUsed: new Date(search.lastUsed)
        }));
        setSavedSearches(searches.sort((a: SavedSearch, b: SavedSearch) => 
          b.lastUsed.getTime() - a.lastUsed.getTime()
        ));
      }
    } catch (error) {
      console.error('Error loading saved searches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSavedSearches = async (searches: SavedSearch[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (error) {
      console.error('Error saving searches:', error);
    }
  };

  const saveCurrentSearch = useCallback(async () => {
    if (!newSearchName.trim()) {
      Alert.alert('Chyba', 'Zadejte název pro uložené vyhledávání');
      return;
    }

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: newSearchName.trim(),
      query: currentQuery,
      filters: currentFilters,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0
    };

    const updatedSearches = [newSearch, ...savedSearches];
    setSavedSearches(updatedSearches);
    await saveSavedSearches(updatedSearches);
    
    setNewSearchName('');
    setShowSaveDialog(false);
    
    Alert.alert('Úspěch', 'Vyhledávání bylo uloženo');
  }, [newSearchName, currentQuery, currentFilters, savedSearches]);

  const deleteSearch = useCallback(async (searchId: string) => {
    Alert.alert(
      'Smazat vyhledávání',
      'Opravdu chcete smazat toto uložené vyhledávání?',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat',
          style: 'destructive',
          onPress: async () => {
            const updatedSearches = savedSearches.filter(search => search.id !== searchId);
            setSavedSearches(updatedSearches);
            await saveSavedSearches(updatedSearches);
          }
        }
      ]
    );
  }, [savedSearches]);

  const selectSearch = useCallback(async (search: SavedSearch) => {
    // Aktualizovat statistiky použití
    const updatedSearch = {
      ...search,
      lastUsed: new Date(),
      useCount: search.useCount + 1
    };

    const updatedSearches = savedSearches.map(s => 
      s.id === search.id ? updatedSearch : s
    );

    setSavedSearches(updatedSearches);
    await saveSavedSearches(updatedSearches);
    
    onSearchSelect(updatedSearch);
  }, [savedSearches, onSearchSelect]);

  const getFilterSummary = (filters: any) => {
    const parts = [];
    
    if (filters.country) parts.push(`Země: ${filters.country}`);
    if (filters.material) parts.push(`Materiál: ${filters.material}`);
    if (filters.yearFrom && filters.yearTo) {
      parts.push(`Roky: ${filters.yearFrom}-${filters.yearTo}`);
    }
    if (filters.priceFrom && filters.priceTo) {
      parts.push(`Cena: ${filters.priceFrom}-${filters.priceTo} Kč`);
    }
    if (filters.condition) parts.push(`Stav: ${filters.condition}`);
    
    return parts.length > 0 ? parts.join(' • ') : 'Bez filtrů';
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Dnes';
    if (diffDays === 1) return 'Včera';
    if (diffDays < 7) return `Před ${diffDays} dny`;
    if (diffDays < 30) return `Před ${Math.floor(diffDays / 7)} týdny`;
    
    return date.toLocaleDateString('cs-CZ');
  };

  const renderSearch = ({ item }: { item: SavedSearch }) => (
    <TouchableOpacity
      style={styles.searchItem}
      onPress={() => selectSearch(item)}
    >
      <View style={styles.searchContent}>
        <View style={styles.searchHeader}>
          <Text style={styles.searchName}>{item.name}</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteSearch(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>
        
        {item.query && (
          <Text style={styles.searchQuery}>"{item.query}"</Text>
        )}
        
        <Text style={styles.searchFilters} numberOfLines={2}>
          {getFilterSummary(item.filters)}
        </Text>
        
        <View style={styles.searchMeta}>
          <Text style={styles.searchDate}>
            {formatDate(item.lastUsed)}
          </Text>
          <Text style={styles.searchStats}>
            Použito {item.useCount}×
          </Text>
          {item.resultCount !== undefined && (
            <Text style={styles.searchResults}>
              {item.resultCount} výsledků
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSaveDialog = () => (
    <View style={styles.saveDialog}>
      <View style={styles.saveDialogContent}>
        <Text style={styles.saveDialogTitle}>Uložit vyhledávání</Text>
        
        <TextInput
          style={styles.saveDialogInput}
          value={newSearchName}
          onChangeText={setNewSearchName}
          placeholder="Název vyhledávání..."
          placeholderTextColor="#999"
          autoFocus
        />
        
        <View style={styles.saveDialogPreview}>
          <Text style={styles.previewLabel}>Náhled:</Text>
          {currentQuery && (
            <Text style={styles.previewQuery}>"{currentQuery}"</Text>
          )}
          <Text style={styles.previewFilters}>
            {getFilterSummary(currentFilters)}
          </Text>
        </View>
        
        <View style={styles.saveDialogButtons}>
          <TouchableOpacity
            style={[styles.saveDialogButton, styles.cancelButton]}
            onPress={() => setShowSaveDialog(false)}
          >
            <Text style={styles.cancelButtonText}>Zrušit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveDialogButton, styles.saveButton]}
            onPress={saveCurrentSearch}
          >
            <Text style={styles.saveButtonText}>Uložit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uložená vyhledávání</Text>
        <View style={styles.headerButtons}>
          {(currentQuery || Object.keys(currentFilters).length > 0) && (
            <TouchableOpacity
              style={styles.saveCurrentButton}
              onPress={() => setShowSaveDialog(true)}
            >
              <Ionicons name="bookmark-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Načítání...</Text>
        </View>
      ) : savedSearches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>Žádná uložená vyhledávání</Text>
          <Text style={styles.emptyText}>
            Uložte si často používaná vyhledávání pro rychlý přístup
          </Text>
          {(currentQuery || Object.keys(currentFilters).length > 0) && (
            <TouchableOpacity
              style={styles.saveFirstButton}
              onPress={() => setShowSaveDialog(true)}
            >
              <Text style={styles.saveFirstButtonText}>Uložit aktuální vyhledávání</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={savedSearches}
          renderItem={renderSearch}
          keyExtractor={(item) => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {showSaveDialog && renderSaveDialog()}
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveCurrentButton: {
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
    lineHeight: 20,
    marginBottom: 24,
  },
  saveFirstButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveFirstButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  searchItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  searchContent: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  searchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchQuery: {
    fontSize: 14,
    color: '#007AFF',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  searchFilters: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  searchMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchDate: {
    fontSize: 11,
    color: '#999',
  },
  searchStats: {
    fontSize: 11,
    color: '#999',
  },
  searchResults: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  saveDialog: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  saveDialogContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  saveDialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  saveDialogInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  saveDialogPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  previewQuery: {
    fontSize: 14,
    color: '#007AFF',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  previewFilters: {
    fontSize: 12,
    color: '#666',
  },
  saveDialogButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveDialogButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SavedSearches;