import React from 'react'
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Button,
  Box
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AddIcon from '@mui/icons-material/Add'
import ListIcon from '@mui/icons-material/List'
import CollectionsIcon from '@mui/icons-material/Collections'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Vítejte v aplikaci pro evidenci mincí. Zde můžete spravovat svou kolekci, 
        přidávat nové mince a sledovat jejich hodnotu.
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Přidat minci
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Přidejte novou minci do katalogu s fotografiami a detailními informacemi.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/add-coin')}
                fullWidth
              >
                Přidat minci
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Katalog mincí
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Prohlédněte si kompletní katalog všech mincí v databázi.
              </Typography>
              <Button
                variant="contained"
                startIcon={<ListIcon />}
                onClick={() => navigate('/coins')}
                fullWidth
              >
                Zobrazit katalog
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Moje kolekce
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Spravujte svou osobní kolekci a sledujte hodnotu investice.
              </Typography>
              <Button
                variant="contained"
                startIcon={<CollectionsIcon />}
                onClick={() => navigate('/collection')}
                fullWidth
              >
                Moje kolekce
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Rychlé statistiky
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  20
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mincí v katalogu
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  5
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  V mé kolekci
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  12
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Zemí původu
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary">
                  45
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fotografií
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

export default Dashboard