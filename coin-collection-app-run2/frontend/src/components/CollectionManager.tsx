import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Divider,
  Alert,
  Autocomplete,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Fab,
  Zoom,
} from '@mui/material';
import {
  Add as AddIcon,
  Collections as CollectionsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Collection, CollectionFormData } from '../types/collection';
import { CoinListItem } from '../types/coin';
import { useCollectionManager, useQuickCollectionActions } from '../hooks/useCollection';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';

interface CollectionManagerProps {
  coinId?: number;
  coin?: CoinListItem;
  onCollectionChange?: (collections: Collection[]) => void;
  showCreateButton?: boolean;
  compact?: boolean;
}

interface CollectionDialogProps {
  open: boolean;
  collection?: Collection;
  onClose: () => void;
  onSave: (data: CollectionFormData) => void;
  isLoading?: boolean;
}

interface AddToCollectionDialogProps {
  open: boolean;
  coin: CoinListItem;
  collections: Collection[];
  onClose: () => void;
  onAdd: (collectionId: number, data: any) => void;
  isLoading?: boolean;
}

const CollectionDialog: React.FC<CollectionDialogProps> = ({
  open,
  collection,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CollectionFormData>({
    name: collection?.name || '',
    description: collection?.description || '',
    is_public: collection?.is_public || false,
    tags: collection?.tags || [],
  });
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = () => {
    if (formData.name.trim()) {
      onSave(formData);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || [],
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {collection ? 'Upravit kolekci' : 'Nová kolekce'}
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Název kolekce"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Popis"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_public}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                />
              }
              label="Veřejná kolekce"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Přidat štítek"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <Button onClick={handleAddTag} disabled={!tagInput.trim()}>
                      Přidat
                    </Button>
                  ),
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.tags?.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  size="small"
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!formData.name.trim() || isLoading}
        >
          {collection ? 'Uložit' : 'Vytvořit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const AddToCollectionDialog: React.FC<AddToCollectionDialogProps> = ({
  open,
  coin,
  collections,
  onClose,
  onAdd,
  isLoading = false,
}) => {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (selectedCollection) {
      onAdd(selectedCollection.id, {
        purchasePrice: purchasePrice || undefined,
        purchaseDate: purchaseDate || undefined,
        notes: notes || undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Přidat do kolekce
        <Typography variant="body2" color="text.secondary">
          {coin.name}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Autocomplete
              options={collections}
              getOptionLabel={(option) => option.name}
              value={selectedCollection}
              onChange={(_, value) => setSelectedCollection(value)}
              renderInput={(params) => (
                <TextField {...params} label="Vyberte kolekci" required />
              )}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Nákupní cena"
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value ? parseFloat(e.target.value) : '')}
              InputProps={{
                endAdornment: coin.currency,
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Datum nákupu"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Poznámky"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={3}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button 
          onClick={handleAdd} 
          variant="contained"
          disabled={!selectedCollection || isLoading}
        >
          Přidat
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const CollectionManager: React.FC<CollectionManagerProps> = ({
  coinId,
  coin,
  onCollectionChange,
  showCreateButton = true,
  compact = false,
}) => {
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [addToCollectionDialogOpen, setAddToCollectionDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | undefined>();
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; collection: Collection } | null>(null);

  const { collections, quickAddToCollection, quickRemoveFromCollection } = useQuickCollectionActions();

  const handleCreateCollection = (data: CollectionFormData) => {
    // Implementace vytvoření kolekce
    console.log('Creating collection:', data);
    setCollectionDialogOpen(false);
  };

  const handleUpdateCollection = (data: CollectionFormData) => {
    // Implementace aktualizace kolekce
    console.log('Updating collection:', editingCollection?.id, data);
    setCollectionDialogOpen(false);
    setEditingCollection(undefined);
  };

  const handleAddToCollection = (collectionId: number, data: any) => {
    if (coin) {
      quickAddToCollection(coin.id, collectionId, data);
      setAddToCollectionDialogOpen(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, collection: Collection) => {
    setMenuAnchor({ element: event.currentTarget, collection });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setCollectionDialogOpen(true);
    handleMenuClose();
  };

  if (compact) {
    return (
      <Box>
        {/* Quick Add Button */}
        {coin && (
          <Button
            startIcon={<AddIcon />}
            onClick={() => setAddToCollectionDialogOpen(true)}
            variant="outlined"
            size="small"
          >
            Přidat do kolekce
          </Button>
        )}

        {/* Collections List */}
        {collections.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Moje kolekce ({collections.length})
            </Typography>
            
            <List dense>
              {collections.slice(0, 3).map((collection) => (
                <ListItem key={collection.id} divider>
                  <ListItemAvatar>
                    <Avatar>
                      <CollectionsIcon />
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={collection.name}
                    secondary={`${collection.items_count} mincí • ${formatCurrency(collection.total_value)}`}
                  />
                  
                  <ListItemSecondaryAction>
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, collection)}>
                      <MoreVertIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            
            {collections.length > 3 && (
              <Button size="small" sx={{ mt: 1 }}>
                Zobrazit všechny ({collections.length})
              </Button>
            )}
          </Box>
        )}

        {/* Dialogs */}
        <CollectionDialog
          open={collectionDialogOpen}
          collection={editingCollection}
          onClose={() => {
            setCollectionDialogOpen(false);
            setEditingCollection(undefined);
          }}
          onSave={editingCollection ? handleUpdateCollection : handleCreateCollection}
        />

        {coin && (
          <AddToCollectionDialog
            open={addToCollectionDialogOpen}
            coin={coin}
            collections={collections}
            onClose={() => setAddToCollectionDialogOpen(false)}
            onAdd={handleAddToCollection}
          />
        )}

        {/* Context Menu */}
        <Menu
          anchorEl={menuAnchor?.element}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleEditCollection(menuAnchor!.collection)}>
            <EditIcon sx={{ mr: 1 }} />
            Upravit
          </MenuItem>
          <MenuItem onClick={handleMenuClose}>
            <VisibilityIcon sx={{ mr: 1 }} />
            Zobrazit
          </MenuItem>
          <MenuItem onClick={handleMenuClose}>
            <ShareIcon sx={{ mr: 1 }} />
            Sdílet
          </MenuItem>
          <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
            <DeleteIcon sx={{ mr: 1 }} />
            Smazat
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Moje kolekce
          <Badge badgeContent={collections.length} color="primary" sx={{ ml: 2 }} />
        </Typography>
        
        {showCreateButton && (
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCollectionDialogOpen(true)}
            variant="contained"
          >
            Nová kolekce
          </Button>
        )}
      </Box>

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <CollectionsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Žádné kolekce
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Vytvořte svou první kolekci a začněte organizovat své mince.
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCollectionDialogOpen(true)}
            variant="contained"
            sx={{ mt: 2 }}
          >
            Vytvořit kolekci
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {collections.map((collection) => (
            <Grid item xs={12} sm={6} md={4} key={collection.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="div" noWrap>
                      {collection.name}
                    </Typography>
                    
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, collection)}>
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  {collection.description && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {collection.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {collection.is_public && (
                      <Chip label="Veřejná" size="small" color="primary" />
                    )}
                    {collection.tags?.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Mince
                      </Typography>
                      <Typography variant="h6">
                        {formatNumber(collection.items_count)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Hodnota
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {formatCurrency(collection.total_value)}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    Aktualizováno {formatDate(collection.updated_at)}
                  </Typography>
                </CardContent>

                <CardActions>
                  <Button size="small" startIcon={<VisibilityIcon />}>
                    Zobrazit
                  </Button>
                  
                  {coin && (
                    <Button 
                      size="small" 
                      startIcon={<AddIcon />}
                      onClick={() => quickAddToCollection(coin.id, collection.id)}
                    >
                      Přidat minci
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Floating Action Button for mobile */}
      {showCreateButton && (
        <Zoom in={true}>
          <Fab
            color="primary"
            onClick={() => setCollectionDialogOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              display: { xs: 'flex', md: 'none' },
            }}
          >
            <AddIcon />
          </Fab>
        </Zoom>
      )}

      {/* Dialogs */}
      <CollectionDialog
        open={collectionDialogOpen}
        collection={editingCollection}
        onClose={() => {
          setCollectionDialogOpen(false);
          setEditingCollection(undefined);
        }}
        onSave={editingCollection ? handleUpdateCollection : handleCreateCollection}
      />

      {coin && (
        <AddToCollectionDialog
          open={addToCollectionDialogOpen}
          coin={coin}
          collections={collections}
          onClose={() => setAddToCollectionDialogOpen(false)}
          onAdd={handleAddToCollection}
        />
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEditCollection(menuAnchor!.collection)}>
          <EditIcon sx={{ mr: 1 }} />
          Upravit
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <VisibilityIcon sx={{ mr: 1 }} />
          Zobrazit detail
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ShareIcon sx={{ mr: 1 }} />
          Sdílet
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <DownloadIcon sx={{ mr: 1 }} />
          Exportovat
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Smazat
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default CollectionManager;