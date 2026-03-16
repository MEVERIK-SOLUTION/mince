import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Paper,
  Divider,
  Tooltip,
  Badge,
  useTheme,
  useMediaQuery,
  Skeleton,
  Snackbar,
  Switch,
} from '@mui/material';
import {
  Share as ShareIcon,
  Public as PublicIcon,
  Group as TeamIcon,
  Email as EmailIcon,
  Link as LinkIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  AdminPanelSettings as AdminIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Comment as CommentIcon,
  Download as DownloadIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationsIcon,
  ContentCopy as CopyIcon,
  QrCode as QrCodeIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';

interface Collection {
  id: number;
  name: string;
  description: string;
  coin_count: number;
  total_value: number;
}

interface SharedCollection {
  share_id: number;
  collection: {
    id: number;
    name: string;
    description: string;
    coin_count: number;
  };
  shared_user: {
    id: number;
    email: string;
    full_name: string;
  };
  permission: string;
  status: string;
  shared_at: string;
  accepted_at?: string;
  expires_at?: string;
  allow_download: boolean;
  allow_comments: boolean;
}

interface PublicShare {
  public_id: number;
  public_slug: string;
  public_url: string;
  collection_name: string;
  settings: {
    allow_comments: boolean;
    allow_downloads: boolean;
    require_registration: boolean;
  };
}

interface Team {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  member_count: number;
  max_members: number;
  user_role: string;
  is_owner: boolean;
  created_at: string;
}

interface SharingStatistics {
  collections_shared_by_user: number;
  collections_shared_with_user: number;
  public_collections: number;
  total_public_views: number;
  teams_owned: number;
  teams_member: number;
}

interface SharingManagerProps {
  collections: Collection[];
  selectedCollectionId?: number;
}

const PERMISSION_LABELS = {
  view: 'Zobrazení',
  edit: 'Úpravy',
  admin: 'Administrátor',
};

const PERMISSION_ICONS = {
  view: ViewIcon,
  edit: EditIcon,
  admin: AdminIcon,
};

const STATUS_LABELS = {
  pending: 'Čeká na odpověď',
  accepted: 'Přijato',
  declined: 'Odmítnuto',
  revoked: 'Zrušeno',
};

const STATUS_COLORS = {
  pending: 'warning',
  accepted: 'success',
  declined: 'error',
  revoked: 'default',
} as const;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sharing-tabpanel-${index}`}
      aria-labelledby={`sharing-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

export const SharingManager: React.FC<SharingManagerProps> = ({
  collections,
  selectedCollectionId,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [tabValue, setTabValue] = useState(0);
  const [sharedCollections, setSharedCollections] = useState<SharedCollection[]>([]);
  const [receivedShares, setReceivedShares] = useState<SharedCollection[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [statistics, setStatistics] = useState<SharingStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [publicShareDialogOpen, setPublicShareDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Form states
  const [selectedCollection, setSelectedCollection] = useState<number>(selectedCollectionId || 0);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [invitationMessage, setInvitationMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowComments, setAllowComments] = useState(true);

  // Public share form
  const [publicTitle, setPublicTitle] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [publicTags, setPublicTags] = useState('');
  const [publicAllowComments, setPublicAllowComments] = useState(true);
  const [publicAllowDownloads, setPublicAllowDownloads] = useState(false);
  const [requireRegistration, setRequireRegistration] = useState(false);

  // Team form
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamIsPublic, setTeamIsPublic] = useState(false);
  const [teamMaxMembers, setTeamMaxMembers] = useState(50);

  // Invite form
  const [selectedTeam, setSelectedTeam] = useState<number>(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('view');

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  useEffect(() => {
    loadSharingData();
  }, []);

  const loadSharingData = async () => {
    try {
      setLoading(true);
      
      // Load shared collections
      const sharedResponse = await fetch('/api/shares/my-collections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (sharedResponse.ok) {
        const sharedData = await sharedResponse.json();
        setSharedCollections(sharedData.shared_collections);
      }

      // Load received shares
      const receivedResponse = await fetch('/api/shares/shared-with-me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (receivedResponse.ok) {
        const receivedData = await receivedResponse.json();
        setReceivedShares(receivedData.shared_collections);
      }

      // Load teams
      const teamsResponse = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        setTeams(teamsData.teams);
      }

      // Load statistics
      const statsResponse = await fetch('/api/sharing/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics(statsData.statistics);
      }

    } catch (error) {
      console.error('Error loading sharing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareCollection = async () => {
    if (!selectedCollection || !shareEmail) return;

    try {
      const params = new URLSearchParams({
        permission: sharePermission,
        allow_download: allowDownload.toString(),
        allow_comments: allowComments.toString(),
        ...(expiresInDays && { expires_days: expiresInDays.toString() }),
      });

      const response = await fetch(`/api/collections/${selectedCollection}/share?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          shared_with_email: shareEmail,
          invitation_message: invitationMessage || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        setShareDialogOpen(false);
        resetShareForm();
        loadSharingData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Chyba při sdílení kolekce',
        severity: 'error',
      });
    }
  };

  const handleCreatePublicShare = async () => {
    if (!selectedCollection) return;

    try {
      const params = new URLSearchParams({
        allow_comments: publicAllowComments.toString(),
        allow_downloads: publicAllowDownloads.toString(),
        require_registration: requireRegistration.toString(),
      });

      const response = await fetch(`/api/collections/${selectedCollection}/public?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          public_title: publicTitle || undefined,
          public_description: publicDescription || undefined,
          tags: publicTags || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        setPublicShareDialogOpen(false);
        resetPublicShareForm();
        loadSharingData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Chyba při zveřejňování kolekce',
        severity: 'error',
      });
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName) return;

    try {
      const params = new URLSearchParams({
        is_public: teamIsPublic.toString(),
        max_members: teamMaxMembers.toString(),
      });

      const response = await fetch(`/api/teams?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: teamName,
          description: teamDescription || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        setTeamDialogOpen(false);
        resetTeamForm();
        loadSharingData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Chyba při vytváření týmu',
        severity: 'error',
      });
    }
  };

  const handleInviteToTeam = async () => {
    if (!selectedTeam || !inviteEmail) return;

    try {
      const response = await fetch(`/api/teams/${selectedTeam}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          user_email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        setInviteDialogOpen(false);
        resetInviteForm();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Chyba při pozývání do týmu',
        severity: 'error',
      });
    }
  };

  const handleRevokeShare = async (shareId: number) => {
    if (!window.confirm('Opravdu chcete zrušit toto sdílení?')) return;

    try {
      const response = await fetch(`/api/shares/${shareId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Sdílení bylo zrušeno',
          severity: 'success',
        });

        loadSharingData();
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Chyba při rušení sdílení',
        severity: 'error',
      });
    }
  };

  const handleRespondToInvitation = async (shareId: number, accept: boolean) => {
    try {
      const response = await fetch(`/api/shares/${shareId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          accept,
          decline_reason: accept ? undefined : 'Odmítnuto uživatelem',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        loadSharingData();
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Chyba při odpovědi na pozvánku',
        severity: 'error',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({
        open: true,
        message: 'Odkaz zkopírován do schránky',
        severity: 'success',
      });
    });
  };

  const resetShareForm = () => {
    setShareEmail('');
    setSharePermission('view');
    setInvitationMessage('');
    setExpiresInDays(null);
    setAllowDownload(false);
    setAllowComments(true);
  };

  const resetPublicShareForm = () => {
    setPublicTitle('');
    setPublicDescription('');
    setPublicTags('');
    setPublicAllowComments(true);
    setPublicAllowDownloads(false);
    setRequireRegistration(false);
  };

  const resetTeamForm = () => {
    setTeamName('');
    setTeamDescription('');
    setTeamIsPublic(false);
    setTeamMaxMembers(50);
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteRole('view');
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Sdílení kolekcí
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<ShareIcon />}
            variant="contained"
            onClick={() => setShareDialogOpen(true)}
          >
            Sdílet kolekci
          </Button>
          <Button
            startIcon={<PublicIcon />}
            variant="outlined"
            onClick={() => setPublicShareDialogOpen(true)}
          >
            Zveřejnit
          </Button>
          <Button
            startIcon={<TeamIcon />}
            variant="outlined"
            onClick={() => setTeamDialogOpen(true)}
          >
            Nový tým
          </Button>
        </Box>
      </Box>

      {/* Statistics */}
      {statistics && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ShareIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" color="primary">
                  {statistics.collections_shared_by_user}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sdílené kolekce
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ViewIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" color="success.main">
                  {statistics.collections_shared_with_user}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Přijaté kolekce
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <PublicIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" color="info.main">
                  {statistics.public_collections}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Veřejné kolekce
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <ViewIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" color="warning.main">
                  {statistics.total_public_views}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Celkové zobrazení
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <TeamIcon sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                <Typography variant="h4" color="secondary.main">
                  {statistics.teams_owned}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vlastní týmy
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <PeopleIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                <Typography variant="h4">
                  {statistics.teams_member}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Členství v týmech
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab 
            label={
              <Badge badgeContent={sharedCollections.length} color="primary">
                Moje sdílení
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={receivedShares.length} color="success">
                Sdílené se mnou
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={teams.length} color="secondary">
                Týmy
              </Badge>
            } 
          />
        </Tabs>
      </Paper>

      {/* My Shares Tab */}
      <TabPanel value={tabValue} index={0}>
        {sharedCollections.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <ShareIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Žádné sdílené kolekce
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Začněte sdílet své kolekce s ostatními uživateli
            </Typography>
            <Button
              variant="contained"
              startIcon={<ShareIcon />}
              onClick={() => setShareDialogOpen(true)}
            >
              Sdílet kolekci
            </Button>
          </Paper>
        ) : (
          <List>
            {sharedCollections.map((share) => {
              const PermissionIcon = PERMISSION_ICONS[share.permission as keyof typeof PERMISSION_ICONS];
              
              return (
                <ListItem key={share.share_id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <PermissionIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {share.collection.name}
                        </Typography>
                        <Chip 
                          label={STATUS_LABELS[share.status as keyof typeof STATUS_LABELS]} 
                          size="small"
                          color={STATUS_COLORS[share.status as keyof typeof STATUS_COLORS]}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Sdíleno s: {share.shared_user.full_name} ({share.shared_user.email})
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Oprávnění: {PERMISSION_LABELS[share.permission as keyof typeof PERMISSION_LABELS]} • 
                          Sdíleno: {format(parseISO(share.shared_at), 'dd.MM.yyyy HH:mm', { locale: cs })}
                        </Typography>
                        {share.expires_at && (
                          <Typography variant="caption" color="warning.main">
                            Vyprší: {format(parseISO(share.expires_at), 'dd.MM.yyyy', { locale: cs })}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {share.allow_comments && (
                        <Tooltip title="Povoleny komentáře">
                          <CommentIcon color="action" />
                        </Tooltip>
                      )}
                      {share.allow_download && (
                        <Tooltip title="Povoleno stahování">
                          <DownloadIcon color="action" />
                        </Tooltip>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleRevokeShare(share.share_id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}
      </TabPanel>

      {/* Shared With Me Tab */}
      <TabPanel value={tabValue} index={1}>
        {receivedShares.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <ViewIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Žádné sdílené kolekce
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Zde se zobrazí kolekce, které s vámi sdílí ostatní uživatelé
            </Typography>
          </Paper>
        ) : (
          <List>
            {receivedShares.map((share) => {
              const PermissionIcon = PERMISSION_ICONS[share.permission as keyof typeof PERMISSION_ICONS];
              
              return (
                <ListItem key={share.share_id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <PermissionIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {share.collection.name}
                        </Typography>
                        <Chip 
                          label={STATUS_LABELS[share.status as keyof typeof STATUS_LABELS]} 
                          size="small"
                          color={STATUS_COLORS[share.status as keyof typeof STATUS_COLORS]}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Vlastník: {share.shared_user.full_name} ({share.shared_user.email})
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Oprávnění: {PERMISSION_LABELS[share.permission as keyof typeof PERMISSION_LABELS]} • 
                          {share.collection.coin_count} mincí
                        </Typography>
                        {share.status === 'pending' && (
                          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckIcon />}
                              onClick={() => handleRespondToInvitation(share.share_id, true)}
                            >
                              Přijmout
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CloseIcon />}
                              onClick={() => handleRespondToInvitation(share.share_id, false)}
                            >
                              Odmítnout
                            </Button>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {share.allow_comments && (
                        <Tooltip title="Povoleny komentáře">
                          <CommentIcon color="action" />
                        </Tooltip>
                      )}
                      {share.allow_download && (
                        <Tooltip title="Povoleno stahování">
                          <DownloadIcon color="action" />
                        </Tooltip>
                      )}
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}
      </TabPanel>

      {/* Teams Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Moje týmy</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => setInviteDialogOpen(true)}
            disabled={teams.length === 0}
          >
            Pozvat člena
          </Button>
        </Box>

        {teams.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <TeamIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Žádné týmy
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Vytvořte tým pro skupinové sdílení kolekcí
            </Typography>
            <Button
              variant="contained"
              startIcon={<TeamIcon />}
              onClick={() => setTeamDialogOpen(true)}
            >
              Vytvořit tým
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {teams.map((team) => (
              <Grid item xs={12} sm={6} md={4} key={team.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TeamIcon color="primary" />
                      <Typography variant="h6">{team.name}</Typography>
                      {team.is_owner && (
                        <Chip label="Vlastník" size="small" color="primary" />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {team.description || 'Bez popisu'}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {team.member_count}/{team.max_members} členů
                      </Typography>
                      <Chip 
                        label={PERMISSION_LABELS[team.user_role as keyof typeof PERMISSION_LABELS]} 
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    
                    {team.is_public && (
                      <Chip label="Veřejný" size="small" color="info" sx={{ mt: 1 }} />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {/* Share Collection Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Sdílet kolekci</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kolekce</InputLabel>
                <Select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(Number(e.target.value))}
                  label="Kolekce"
                >
                  {collections.map((collection) => (
                    <MenuItem key={collection.id} value={collection.id}>
                      {collection.name} ({collection.coin_count} mincí)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email uživatele"
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Oprávnění</InputLabel>
                <Select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  label="Oprávnění"
                >
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Zpráva k pozvánce (volitelné)"
                multiline
                rows={3}
                value={invitationMessage}
                onChange={(e) => setInvitationMessage(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vyprší za (dny)"
                type="number"
                value={expiresInDays || ''}
                onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
                inputProps={{ min: 1, max: 365 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ pt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={allowDownload}
                      onChange={(e) => setAllowDownload(e.target.checked)}
                    />
                  }
                  label="Povolit stahování"
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={allowComments}
                    onChange={(e) => setAllowComments(e.target.checked)}
                  />
                }
                label="Povolit komentáře"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Zrušit</Button>
          <Button
            onClick={handleShareCollection}
            variant="contained"
            disabled={!selectedCollection || !shareEmail}
          >
            Sdílet
          </Button>
        </DialogActions>
      </Dialog>

      {/* Public Share Dialog */}
      <Dialog open={publicShareDialogOpen} onClose={() => setPublicShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Zveřejnit kolekci</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kolekce</InputLabel>
                <Select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(Number(e.target.value))}
                  label="Kolekce"
                >
                  {collections.map((collection) => (
                    <MenuItem key={collection.id} value={collection.id}>
                      {collection.name} ({collection.coin_count} mincí)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Veřejný název (volitelné)"
                value={publicTitle}
                onChange={(e) => setPublicTitle(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Veřejný popis (volitelné)"
                multiline
                rows={3}
                value={publicDescription}
                onChange={(e) => setPublicDescription(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tagy (oddělené čárkami)"
                value={publicTags}
                onChange={(e) => setPublicTags(e.target.value)}
                placeholder="mince, historie, sbírka"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={publicAllowComments}
                    onChange={(e) => setPublicAllowComments(e.target.checked)}
                  />
                }
                label="Povolit komentáře"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={publicAllowDownloads}
                    onChange={(e) => setPublicAllowDownloads(e.target.checked)}
                  />
                }
                label="Povolit stahování"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={requireRegistration}
                    onChange={(e) => setRequireRegistration(e.target.checked)}
                  />
                }
                label="Vyžadovat registraci"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublicShareDialogOpen(false)}>Zrušit</Button>
          <Button
            onClick={handleCreatePublicShare}
            variant="contained"
            disabled={!selectedCollection}
          >
            Zveřejnit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog open={teamDialogOpen} onClose={() => setTeamDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vytvořit nový tým</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Název týmu"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Popis týmu (volitelné)"
                multiline
                rows={3}
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maximální počet členů"
                type="number"
                value={teamMaxMembers}
                onChange={(e) => setTeamMaxMembers(Number(e.target.value))}
                inputProps={{ min: 2, max: 200 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ pt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={teamIsPublic}
                      onChange={(e) => setTeamIsPublic(e.target.checked)}
                    />
                  }
                  label="Veřejný tým"
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamDialogOpen(false)}>Zrušit</Button>
          <Button
            onClick={handleCreateTeam}
            variant="contained"
            disabled={!teamName}
          >
            Vytvořit tým
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite to Team Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Pozvat do týmu</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Tým</InputLabel>
                <Select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(Number(e.target.value))}
                  label="Tým"
                >
                  {teams.filter(team => team.is_owner || team.user_role === 'admin').map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name} ({team.member_count}/{team.max_members} členů)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email uživatele"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role v týmu</InputLabel>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  label="Role v týmu"
                >
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Zrušit</Button>
          <Button
            onClick={handleInviteToTeam}
            variant="contained"
            disabled={!selectedTeam || !inviteEmail}
          >
            Pozvat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SharingManager;