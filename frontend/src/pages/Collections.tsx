import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark'
import { collectionService } from '../services/coinService'

export default function Collections() {
  const queryClient = useQueryClient()
  const [createDialog, setCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [snack, setSnack] = useState('')

  const { data: collections, isLoading, error } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionService.getCollections(),
  })

  const createMutation = useMutation({
    mutationFn: () => collectionService.createCollection(newName, newDesc || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setCreateDialog(false)
      setNewName('')
      setNewDesc('')
      setSnack('Kolekce vytvořena')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collectionService.deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setSnack('Kolekce smazána')
    },
  })

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Kolekce</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialog(true)}
        >
          Nová kolekce
        </Button>
      </Box>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>}
      {error && <Alert severity="error">Chyba při načítání kolekcí.</Alert>}

      {!isLoading && collections && collections.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <CollectionsBookmarkIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Zatím žádné kolekce
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)}>
            Vytvořit první kolekci
          </Button>
        </Box>
      )}

      <Grid container spacing={3}>
        {(collections ?? []).map((col) => (
          <Grid item xs={12} sm={6} md={4} key={col.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{col.name}</Typography>
                {col.description && (
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {col.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Vytvořena: {new Date(col.created_at).toLocaleDateString('cs-CZ')}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end' }}>
                <Tooltip title="Smazat kolekci">
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => {
                      if (confirm(`Smazat kolekci „${col.name}"?`)) {
                        deleteMutation.mutate(col.id)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nová kolekce</DialogTitle>
        <DialogContent>
          <TextField
            label="Název kolekce"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            required
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Popis (volitelný)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Zrušit</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={!newName.trim() || createMutation.isPending}
          >
            Vytvořit
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
