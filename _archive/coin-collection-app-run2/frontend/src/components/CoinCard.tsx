import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Tooltip,
  Badge,
  Skeleton,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as FileCopyIcon,
  Visibility as VisibilityIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Favorite as FavoriteIcon,
  Collections as CollectionsIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CoinListItem } from '../types/coin';
import { formatCurrency, formatYear, formatImageUrl } from '../utils/formatters';
import { imageApi } from '../services/imageApi';

interface CoinCardProps {
  coin: CoinListItem;
  onEdit?: (coin: CoinListItem) => void;
  onDelete?: (coin: CoinListItem) => void;
  onDuplicate?: (coin: CoinListItem) => void;
  onAddToCollection?: (coin: CoinListItem) => void;
  onToggleFavorite?: (coin: CoinListItem) => void;
  showActions?: boolean;
  isSelected?: boolean;
  onSelect?: (coin: CoinListItem) => void;
  isFavorite?: boolean;
  isInCollection?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

export const CoinCard: React.FC<CoinCardProps> = ({
  coin,
  onEdit,
  onDelete,
  onDuplicate,
  onAddToCollection,
  onToggleFavorite,
  showActions = true,
  isSelected = false,
  onSelect,
  isFavorite = false,
  isInCollection = false,
  variant = 'default',
}) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(coin);
    } else {
      navigate(`/coins/${coin.id}`);
    }
  };

  const handleAction = (action: () => void) => {
    return (event: React.MouseEvent) => {
      event.stopPropagation();
      handleMenuClose();
      action();
    };
  };

  const getImageUrl = () => {
    if (coin.main_image) {
      return imageApi.getImageUrl(coin.main_image, 'medium');
    }
    return '/images/coin-placeholder.png';
  };

  const renderCompactCard = () => (
    <Card
      sx={{
        display: 'flex',
        height: 120,
        cursor: 'pointer',
        border: isSelected ? 2 : 0,
        borderColor: 'primary.main',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
        transition: 'all 0.2s ease-in-out',
      }}
      onClick={handleCardClick}
    >
      <CardMedia
        component="img"
        sx={{ width: 120, height: 120, objectFit: 'cover' }}
        image={getImageUrl()}
        alt={coin.name}
        onLoad={() => setImageLoading(false)}
        onError={() => {
          setImageError(true);
          setImageLoading(false);
        }}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <CardContent sx={{ flex: '1 0 auto', pb: 1 }}>
          <Typography variant="h6" component="div" noWrap>
            {coin.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {coin.country} • {formatYear(coin.year)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {coin.currency}
          </Typography>
        </CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 1, pb: 1 }}>
          <Typography variant="h6" color="primary">
            {formatCurrency(coin.current_value, coin.currency)}
          </Typography>
          {showActions && (
            <IconButton size="small" onClick={handleMenuOpen} sx={{ ml: 'auto' }}>
              <MoreVertIcon />
            </IconButton>
          )}
        </Box>
      </Box>
    </Card>
  );

  const renderDefaultCard = () => (
    <Card
      sx={{
        maxWidth: 300,
        cursor: 'pointer',
        border: isSelected ? 2 : 0,
        borderColor: 'primary.main',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-4px)',
        },
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
      }}
      onClick={handleCardClick}
    >
      {/* Badges */}
      <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
        {isFavorite && (
          <Chip
            icon={<FavoriteIcon />}
            label="Oblíbená"
            size="small"
            color="error"
            sx={{ mb: 0.5 }}
          />
        )}
        {isInCollection && (
          <Chip
            icon={<CollectionsIcon />}
            label="V kolekci"
            size="small"
            color="success"
          />
        )}
      </Box>

      {/* Image */}
      <Box sx={{ position: 'relative', height: 200 }}>
        {imageLoading && (
          <Skeleton variant="rectangular" width="100%" height={200} />
        )}
        <CardMedia
          component="img"
          height="200"
          image={getImageUrl()}
          alt={coin.name}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
          sx={{
            display: imageLoading ? 'none' : 'block',
            objectFit: 'cover',
          }}
        />
        {imageError && (
          <Box
            sx={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.100',
              color: 'grey.500',
            }}
          >
            <PhotoCameraIcon sx={{ fontSize: 48 }} />
          </Box>
        )}
      </Box>

      <CardContent>
        <Typography gutterBottom variant="h6" component="div" noWrap>
          {coin.name}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Chip label={coin.country} size="small" variant="outlined" />
          {coin.year && (
            <Chip label={formatYear(coin.year)} size="small" variant="outlined" />
          )}
          <Chip label={coin.currency} size="small" variant="outlined" />
        </Box>

        {coin.coin_type && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {coin.coin_type}
          </Typography>
        )}

        <Typography variant="h6" color="primary" sx={{ mt: 1 }}>
          {formatCurrency(coin.current_value, coin.currency)}
        </Typography>
      </CardContent>

      {showActions && (
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Box>
            <Tooltip title="Zobrazit detail">
              <IconButton size="small" onClick={(e) => {
                e.stopPropagation();
                navigate(`/coins/${coin.id}`);
              }}>
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            
            {onToggleFavorite && (
              <Tooltip title={isFavorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}>
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(coin);
                  }}
                  color={isFavorite ? "error" : "default"}
                >
                  {isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </CardActions>
      )}
    </Card>
  );

  const renderDetailedCard = () => (
    <Card
      sx={{
        cursor: 'pointer',
        border: isSelected ? 2 : 0,
        borderColor: 'primary.main',
        '&:hover': {
          boxShadow: 4,
        },
        transition: 'all 0.2s ease-in-out',
      }}
      onClick={handleCardClick}
    >
      <Box sx={{ display: 'flex' }}>
        <CardMedia
          component="img"
          sx={{ width: 150, height: 150, objectFit: 'cover' }}
          image={getImageUrl()}
          alt={coin.name}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <CardContent sx={{ flex: '1 0 auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" component="div">
                  {coin.name}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {coin.country} • {formatYear(coin.year)} • {coin.currency}
                </Typography>

                {coin.coin_type && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {coin.coin_type}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  {coin.material && (
                    <Chip label={coin.material} size="small" variant="outlined" />
                  )}
                  {coin.diameter && (
                    <Chip label={`⌀ ${coin.diameter} mm`} size="small" variant="outlined" />
                  )}
                  {coin.weight && (
                    <Chip label={`${coin.weight} g`} size="small" variant="outlined" />
                  )}
                </Box>
              </Box>

              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h6" color="primary">
                  {formatCurrency(coin.current_value, coin.currency)}
                </Typography>
                
                {showActions && (
                  <IconButton size="small" onClick={handleMenuOpen}>
                    <MoreVertIcon />
                  </IconButton>
                )}
              </Box>
            </Box>
          </CardContent>
        </Box>
      </Box>
    </Card>
  );

  return (
    <>
      {variant === 'compact' && renderCompactCard()}
      {variant === 'default' && renderDefaultCard()}
      {variant === 'detailed' && renderDetailedCard()}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleAction(() => navigate(`/coins/${coin.id}`))}>
          <VisibilityIcon sx={{ mr: 1 }} />
          Zobrazit detail
        </MenuItem>
        
        {onEdit && (
          <MenuItem onClick={handleAction(() => onEdit(coin))}>
            <EditIcon sx={{ mr: 1 }} />
            Upravit
          </MenuItem>
        )}
        
        {onDuplicate && (
          <MenuItem onClick={handleAction(() => onDuplicate(coin))}>
            <FileCopyIcon sx={{ mr: 1 }} />
            Duplikovat
          </MenuItem>
        )}
        
        {onAddToCollection && !isInCollection && (
          <MenuItem onClick={handleAction(() => onAddToCollection(coin))}>
            <CollectionsIcon sx={{ mr: 1 }} />
            Přidat do kolekce
          </MenuItem>
        )}
        
        {onDelete && (
          <MenuItem 
            onClick={handleAction(() => onDelete(coin))}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} />
            Smazat
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default CoinCard;