import asyncio
import logging
import numpy as np
import cv2
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import base64
from PIL import Image, ImageEnhance
import io
import hashlib
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import pickle
import os

from ..models.coin import Coin, CoinImage
from ..core.config import settings
from .coin_identification import coin_identification_service

logger = logging.getLogger(__name__)

class ImageSearchService:
    """
    Služba pro pokročilé vyhledávání mincí podle obrázků
    """
    
    def __init__(self):
        self.feature_cache = {}
        self.similarity_threshold = 0.7
        self.max_results = 20
        
        # Konfigurace pro extrakci příznaků
        self.orb = cv2.ORB_create(nfeatures=1000)
        self.sift = cv2.SIFT_create() if hasattr(cv2, 'SIFT_create') else None
        
        # Cache pro uložené příznaky
        self.cache_dir = "cache/image_features"
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Váhy pro různé typy podobnosti
        self.similarity_weights = {
            'visual_features': 0.4,    # Vizuální příznaky (ORB, SIFT)
            'color_histogram': 0.2,    # Barevný histogram
            'shape_features': 0.2,     # Tvarové příznaky
            'metadata_similarity': 0.2  # Podobnost metadat
        }
    
    async def search_similar_coins(
        self, 
        query_image_path: str, 
        db: Session,
        limit: int = 10,
        include_metadata: bool = True
    ) -> Dict:
        """
        Vyhledání podobných mincí podle obrázku
        """
        try:
            # 1. Extrakce příznaků z dotazového obrázku
            query_features = await self._extract_image_features(query_image_path)
            
            if not query_features:
                return {
                    'success': False,
                    'error': 'Nepodařilo se extrahovat příznaky z obrázku'
                }
            
            # 2. Získání všech obrázků mincí z databáze
            coin_images = db.query(CoinImage).join(Coin).all()
            
            if not coin_images:
                return {
                    'success': False,
                    'error': 'Žádné obrázky mincí v databázi'
                }
            
            # 3. Výpočet podobnosti pro každý obrázek
            similarities = []
            
            for coin_image in coin_images:
                try:
                    # Získání příznaků obrázku (z cache nebo výpočet)
                    image_features = await self._get_or_compute_features(coin_image)
                    
                    if image_features:
                        # Výpočet celkové podobnosti
                        similarity_score = self._calculate_similarity(query_features, image_features)
                        
                        if similarity_score >= self.similarity_threshold:
                            similarities.append({
                                'coin_image_id': coin_image.id,
                                'coin_id': coin_image.coin_id,
                                'similarity_score': similarity_score,
                                'image_path': coin_image.image_path,
                                'image_type': coin_image.image_type,
                                'coin': coin_image.coin
                            })
                
                except Exception as e:
                    logger.warning(f"Failed to process image {coin_image.id}: {str(e)}")
                    continue
            
            # 4. Seřazení podle podobnosti
            similarities.sort(key=lambda x: x['similarity_score'], reverse=True)
            similarities = similarities[:limit]
            
            # 5. Příprava výsledků
            results = []
            for sim in similarities:
                coin = sim['coin']
                result = {
                    'coin_id': coin.id,
                    'coin_name': coin.name,
                    'country': coin.country,
                    'year': coin.year,
                    'denomination': coin.denomination,
                    'currency': coin.currency,
                    'similarity_score': sim['similarity_score'],
                    'matched_image': {
                        'id': sim['coin_image_id'],
                        'path': sim['image_path'],
                        'type': sim['image_type']
                    }
                }
                
                if include_metadata:
                    result.update({
                        'material': coin.material,
                        'weight': coin.weight,
                        'diameter': coin.diameter,
                        'current_value': coin.current_value,
                        'rarity': coin.rarity,
                        'condition': coin.condition
                    })
                
                results.append(result)
            
            return {
                'success': True,
                'results': results,
                'total_found': len(results),
                'query_features_extracted': True,
                'search_time': 0  # TODO: měřit čas
            }
            
        except Exception as e:
            logger.error(f"Image search failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _extract_image_features(self, image_path: str) -> Optional[Dict]:
        """
        Extrakce příznaků z obrázku
        """
        try:
            # Načtení obrázku
            image = cv2.imread(image_path)
            if image is None:
                return None
            
            # Konverze do různých barevných prostorů
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            
            features = {}
            
            # 1. ORB příznaky (klíčové body a deskriptory)
            if self.orb:
                keypoints, descriptors = self.orb.detectAndCompute(gray, None)
                if descriptors is not None:
                    features['orb_descriptors'] = descriptors
                    features['orb_keypoints_count'] = len(keypoints)
            
            # 2. SIFT příznaky (pokud je k dispozici)
            if self.sift:
                try:
                    keypoints, descriptors = self.sift.detectAndCompute(gray, None)
                    if descriptors is not None:
                        features['sift_descriptors'] = descriptors
                        features['sift_keypoints_count'] = len(keypoints)
                except Exception as e:
                    logger.warning(f"SIFT extraction failed: {str(e)}")
            
            # 3. Barevný histogram
            features['color_histogram'] = {
                'bgr': [cv2.calcHist([image], [i], None, [256], [0, 256]).flatten() for i in range(3)],
                'hsv': [cv2.calcHist([hsv], [i], None, [256], [0, 256]).flatten() for i in range(3)]
            }
            
            # 4. Tvarové příznaky
            features['shape_features'] = self._extract_shape_features(gray)
            
            # 5. Texturní příznaky
            features['texture_features'] = self._extract_texture_features(gray)
            
            # 6. Geometrické příznaky
            features['geometric_features'] = self._extract_geometric_features(gray)
            
            return features
            
        except Exception as e:
            logger.error(f"Feature extraction failed: {str(e)}")
            return None
    
    def _extract_shape_features(self, gray_image: np.ndarray) -> Dict:
        """
        Extrakce tvarových příznaků
        """
        try:
            # Detekce hran
            edges = cv2.Canny(gray_image, 50, 150)
            
            # Hledání kontur
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                return {}
            
            # Největší kontura (pravděpodobně mince)
            largest_contour = max(contours, key=cv2.contourArea)
            
            # Výpočet momentů
            moments = cv2.moments(largest_contour)
            
            # Hu momenty (invariantní k rotaci, škálování a translaci)
            hu_moments = cv2.HuMoments(moments).flatten()
            
            # Další tvarové charakteristiky
            area = cv2.contourArea(largest_contour)
            perimeter = cv2.arcLength(largest_contour, True)
            
            # Aproximace kontury
            epsilon = 0.02 * perimeter
            approx = cv2.approxPolyDP(largest_contour, epsilon, True)
            
            # Konvexní obal
            hull = cv2.convexHull(largest_contour)
            hull_area = cv2.contourArea(hull)
            
            # Poměry a charakteristiky
            circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
            convexity = area / hull_area if hull_area > 0 else 0
            
            return {
                'hu_moments': hu_moments.tolist(),
                'area': area,
                'perimeter': perimeter,
                'circularity': circularity,
                'convexity': convexity,
                'vertices_count': len(approx)
            }
            
        except Exception as e:
            logger.warning(f"Shape feature extraction failed: {str(e)}")
            return {}
    
    def _extract_texture_features(self, gray_image: np.ndarray) -> Dict:
        """
        Extrakce texturních příznaků
        """
        try:
            # LBP (Local Binary Pattern)
            def lbp(image, radius=1, n_points=8):
                lbp_image = np.zeros_like(image)
                for i in range(radius, image.shape[0] - radius):
                    for j in range(radius, image.shape[1] - radius):
                        center = image[i, j]
                        binary_string = ''
                        for k in range(n_points):
                            angle = 2 * np.pi * k / n_points
                            x = int(i + radius * np.cos(angle))
                            y = int(j + radius * np.sin(angle))
                            if image[x, y] >= center:
                                binary_string += '1'
                            else:
                                binary_string += '0'
                        lbp_image[i, j] = int(binary_string, 2)
                return lbp_image
            
            lbp_image = lbp(gray_image)
            lbp_histogram = np.histogram(lbp_image, bins=256, range=(0, 256))[0]
            
            # Gabor filtry
            gabor_responses = []
            for theta in [0, 45, 90, 135]:
                kernel = cv2.getGaborKernel((21, 21), 5, np.radians(theta), 2*np.pi*0.5, 0.5, 0, ktype=cv2.CV_32F)
                filtered = cv2.filter2D(gray_image, cv2.CV_8UC3, kernel)
                gabor_responses.append(np.mean(filtered))
            
            return {
                'lbp_histogram': lbp_histogram.tolist(),
                'gabor_responses': gabor_responses
            }
            
        except Exception as e:
            logger.warning(f"Texture feature extraction failed: {str(e)}")
            return {}
    
    def _extract_geometric_features(self, gray_image: np.ndarray) -> Dict:
        """
        Extrakce geometrických příznaků
        """
        try:
            # Detekce kruhů (Hough Transform)
            circles = cv2.HoughCircles(
                gray_image,
                cv2.HOUGH_GRADIENT,
                dp=1,
                minDist=30,
                param1=50,
                param2=30,
                minRadius=10,
                maxRadius=0
            )
            
            features = {
                'circles_detected': 0,
                'largest_circle_radius': 0,
                'circle_centers': []
            }
            
            if circles is not None:
                circles = np.round(circles[0, :]).astype("int")
                features['circles_detected'] = len(circles)
                
                if len(circles) > 0:
                    # Největší kruh
                    largest_circle = max(circles, key=lambda c: c[2])
                    features['largest_circle_radius'] = int(largest_circle[2])
                    features['circle_centers'] = [[int(c[0]), int(c[1])] for c in circles]
            
            return features
            
        except Exception as e:
            logger.warning(f"Geometric feature extraction failed: {str(e)}")
            return {}
    
    async def _get_or_compute_features(self, coin_image: CoinImage) -> Optional[Dict]:
        """
        Získání příznaků obrázku z cache nebo jejich výpočet
        """
        try:
            # Hash pro identifikaci obrázku
            image_hash = hashlib.md5(f"{coin_image.id}_{coin_image.image_path}".encode()).hexdigest()
            cache_file = os.path.join(self.cache_dir, f"{image_hash}.pkl")
            
            # Pokus o načtení z cache
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'rb') as f:
                        return pickle.load(f)
                except Exception as e:
                    logger.warning(f"Failed to load cached features: {str(e)}")
            
            # Výpočet příznaků
            full_image_path = os.path.join("uploads", coin_image.image_path)
            features = await self._extract_image_features(full_image_path)
            
            # Uložení do cache
            if features:
                try:
                    with open(cache_file, 'wb') as f:
                        pickle.dump(features, f)
                except Exception as e:
                    logger.warning(f"Failed to cache features: {str(e)}")
            
            return features
            
        except Exception as e:
            logger.error(f"Failed to get/compute features: {str(e)}")
            return None
    
    def _calculate_similarity(self, features1: Dict, features2: Dict) -> float:
        """
        Výpočet celkové podobnosti mezi dvěma sadami příznaků
        """
        try:
            similarities = {}
            
            # 1. Podobnost vizuálních příznaků (ORB)
            if 'orb_descriptors' in features1 and 'orb_descriptors' in features2:
                similarities['visual_features'] = self._compare_descriptors(
                    features1['orb_descriptors'], 
                    features2['orb_descriptors']
                )
            
            # 2. Podobnost barevného histogramu
            if 'color_histogram' in features1 and 'color_histogram' in features2:
                similarities['color_histogram'] = self._compare_histograms(
                    features1['color_histogram'], 
                    features2['color_histogram']
                )
            
            # 3. Podobnost tvarových příznaků
            if 'shape_features' in features1 and 'shape_features' in features2:
                similarities['shape_features'] = self._compare_shape_features(
                    features1['shape_features'], 
                    features2['shape_features']
                )
            
            # 4. Výpočet vážené podobnosti
            total_similarity = 0.0
            total_weight = 0.0
            
            for feature_type, weight in self.similarity_weights.items():
                if feature_type in similarities:
                    total_similarity += similarities[feature_type] * weight
                    total_weight += weight
            
            return total_similarity / total_weight if total_weight > 0 else 0.0
            
        except Exception as e:
            logger.error(f"Similarity calculation failed: {str(e)}")
            return 0.0
    
    def _compare_descriptors(self, desc1: np.ndarray, desc2: np.ndarray) -> float:
        """
        Porovnání deskriptorů pomocí FLANN matcher
        """
        try:
            if desc1 is None or desc2 is None or len(desc1) == 0 or len(desc2) == 0:
                return 0.0
            
            # FLANN matcher
            FLANN_INDEX_KDTREE = 1
            index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
            search_params = dict(checks=50)
            
            flann = cv2.FlannBasedMatcher(index_params, search_params)
            matches = flann.knnMatch(desc1, desc2, k=2)
            
            # Lowe's ratio test
            good_matches = []
            for match_pair in matches:
                if len(match_pair) == 2:
                    m, n = match_pair
                    if m.distance < 0.7 * n.distance:
                        good_matches.append(m)
            
            # Podobnost jako poměr dobrých shod
            similarity = len(good_matches) / min(len(desc1), len(desc2))
            return min(similarity, 1.0)
            
        except Exception as e:
            logger.warning(f"Descriptor comparison failed: {str(e)}")
            return 0.0
    
    def _compare_histograms(self, hist1: Dict, hist2: Dict) -> float:
        """
        Porovnání barevných histogramů
        """
        try:
            similarities = []
            
            # Porovnání BGR histogramů
            if 'bgr' in hist1 and 'bgr' in hist2:
                for i in range(3):
                    correlation = cv2.compareHist(
                        np.array(hist1['bgr'][i], dtype=np.float32),
                        np.array(hist2['bgr'][i], dtype=np.float32),
                        cv2.HISTCMP_CORREL
                    )
                    similarities.append(max(0, correlation))
            
            # Porovnání HSV histogramů
            if 'hsv' in hist1 and 'hsv' in hist2:
                for i in range(3):
                    correlation = cv2.compareHist(
                        np.array(hist1['hsv'][i], dtype=np.float32),
                        np.array(hist2['hsv'][i], dtype=np.float32),
                        cv2.HISTCMP_CORREL
                    )
                    similarities.append(max(0, correlation))
            
            return np.mean(similarities) if similarities else 0.0
            
        except Exception as e:
            logger.warning(f"Histogram comparison failed: {str(e)}")
            return 0.0
    
    def _compare_shape_features(self, shape1: Dict, shape2: Dict) -> float:
        """
        Porovnání tvarových příznaků
        """
        try:
            similarities = []
            
            # Porovnání Hu momentů
            if 'hu_moments' in shape1 and 'hu_moments' in shape2:
                hu1 = np.array(shape1['hu_moments'])
                hu2 = np.array(shape2['hu_moments'])
                
                # Cosine similarity
                if np.linalg.norm(hu1) > 0 and np.linalg.norm(hu2) > 0:
                    hu_similarity = np.dot(hu1, hu2) / (np.linalg.norm(hu1) * np.linalg.norm(hu2))
                    similarities.append(max(0, hu_similarity))
            
            # Porovnání cirkularity
            if 'circularity' in shape1 and 'circularity' in shape2:
                circ_diff = abs(shape1['circularity'] - shape2['circularity'])
                circ_similarity = 1.0 - min(circ_diff, 1.0)
                similarities.append(circ_similarity)
            
            # Porovnání konvexity
            if 'convexity' in shape1 and 'convexity' in shape2:
                conv_diff = abs(shape1['convexity'] - shape2['convexity'])
                conv_similarity = 1.0 - min(conv_diff, 1.0)
                similarities.append(conv_similarity)
            
            return np.mean(similarities) if similarities else 0.0
            
        except Exception as e:
            logger.warning(f"Shape comparison failed: {str(e)}")
            return 0.0
    
    async def batch_search_similar_coins(
        self, 
        query_images: List[str], 
        db: Session,
        limit: int = 10
    ) -> Dict:
        """
        Dávkové vyhledávání podobných mincí pro více obrázků
        """
        try:
            results = []
            
            for i, image_path in enumerate(query_images):
                search_result = await self.search_similar_coins(
                    image_path, db, limit
                )
                
                results.append({
                    'query_index': i,
                    'query_image': image_path,
                    'search_result': search_result
                })
            
            return {
                'success': True,
                'batch_results': results,
                'total_queries': len(query_images)
            }
            
        except Exception as e:
            logger.error(f"Batch search failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def clear_feature_cache(self):
        """
        Vymazání cache příznaků
        """
        try:
            for filename in os.listdir(self.cache_dir):
                if filename.endswith('.pkl'):
                    os.remove(os.path.join(self.cache_dir, filename))
            
            logger.info("Feature cache cleared")
            
        except Exception as e:
            logger.error(f"Failed to clear cache: {str(e)}")

# Singleton instance
image_search_service = ImageSearchService()