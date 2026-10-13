import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  mirrorGuideCreate,
  mirrorGuideDelete,
  mirrorGuideSetEnabled,
  mirrorGuideUpdate,
} from '../lib/convexMirror';
import {
    Plus,
    Edit2,
    Trash2,
    X,
    FileText,
    Eye,
    EyeOff,
    GripVertical,
    ArrowLeft,
    Package,
    Check,
    Bold,
    Italic,
    Underline
} from 'lucide-react';
import ImageUpload from './ImageUpload';
import { optimizedImageUrl } from '../lib/imagekit';

interface Article {
    id: string;
    title: string;
    preview: string | null;
    content: string;
    cover_image: string | null;
    author: string;
    published_date: string;
    display_order: number;
    is_enabled: boolean;
    created_at: string;
    updated_at: string;
    related_product_ids: string[] | null;
}

interface SimpleProduct {
    id: string;
    name: string;
    base_price: number;
    image_url: string | null;
}

interface ModalData {
    id?: string;
    title: string;
    preview: string;
    content: string;
    cover_image: string | null;
    author: string;
    published_date: string;
    display_order: number;
    is_enabled: boolean;
    related_product_ids: string[];
}

export default function GuideManager() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState<ModalData>({
        title: '',
        preview: '',
        content: '',
        cover_image: null,
        author: 'SlimDose Team',
        published_date: new Date().toISOString().split('T')[0],
        display_order: 0,
        is_enabled: true,
        related_product_ids: []
    });
    const [editingArticle, setEditingArticle] = useState<string | null>(null);
    const [products, setProducts] = useState<SimpleProduct[]>([]);
    const contentEditorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchArticles();
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, base_price, image_url')
                .order('name');
            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchArticles = async () => {
        try {
            const { data, error } = await supabase
                .from('guide_topics')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;

            if (data) {
                setArticles(data);
            }
        } catch (error) {
            console.error('Error fetching articles:', error);
            alert('Failed to fetch articles');
        }
    };

    const openModal = (article?: Article) => {
        if (article) {
            setModalData({
                id: article.id,
                title: article.title,
                preview: article.preview || '',
                content: article.content,
                cover_image: article.cover_image,
                author: article.author,
                published_date: article.published_date,
                display_order: article.display_order,
                is_enabled: article.is_enabled,
                related_product_ids: article.related_product_ids || []
            });
            setEditingArticle(article.id);
        } else {
            const maxOrder = articles.length > 0 ? Math.max(...articles.map(a => a.display_order)) : -1;
            setModalData({
                title: '',
                preview: '',
                content: '',
                cover_image: null,
                author: 'SlimDose Team',
                published_date: new Date().toISOString().split('T')[0],
                display_order: maxOrder + 1,
                is_enabled: true,
                related_product_ids: []
            });
            setEditingArticle(null);
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setModalData({
            title: '',
            preview: '',
            content: '',
            cover_image: null,
            author: 'SlimDose Team',
            published_date: new Date().toISOString().split('T')[0],
            display_order: 0,
            is_enabled: true,
            related_product_ids: []
        });
        setEditingArticle(null);
    };

    const saveArticle = async () => {
        try {
            if (!modalData.title.trim()) {
                alert('Please enter an article title');
                return;
            }

            if (!modalData.content.trim()) {
                alert('Please enter article content');
                return;
            }

            const articleData = {
                title: modalData.title,
                preview: modalData.preview || null,
                content: modalData.content,
                cover_image: modalData.cover_image,
                author: modalData.author,
                published_date: modalData.published_date,
                display_order: modalData.display_order,
                is_enabled: modalData.is_enabled,
                related_product_ids: modalData.related_product_ids
            };

            if (editingArticle) {
                // Update existing article
                const { error } = await supabase
                    .from('guide_topics')
                    .update({
                        ...articleData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingArticle);

                if (error) throw error;
                mirrorGuideUpdate(editingArticle, articleData);
            } else {
                // Create new article
                const { error } = await supabase
                    .from('guide_topics')
                    .insert(articleData);

                if (error) throw error;
                mirrorGuideCreate(articleData);
            }

            closeModal();
            fetchArticles();
        } catch (error) {
            console.error('Error saving article:', error);
            alert('Failed to save article');
        }
    };

    const deleteArticle = async (articleId: string) => {
        if (!confirm('Are you sure you want to delete this article?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('guide_topics')
                .delete()
                .eq('id', articleId);

            if (error) throw error;
            mirrorGuideDelete(articleId);

            fetchArticles();
        } catch (error) {
            console.error('Error deleting article:', error);
            alert('Failed to delete article');
        }
    };

    const toggleEnabled = async (articleId: string, currentlyEnabled: boolean) => {
        try {
            const { error } = await supabase
                .from('guide_topics')
                .update({ is_enabled: !currentlyEnabled, updated_at: new Date().toISOString() })
                .eq('id', articleId);

            if (error) throw error;
            mirrorGuideSetEnabled(articleId, !currentlyEnabled);

            fetchArticles();
        } catch (error) {
            console.error('Error toggling article:', error);
            alert('Failed to update article status');
        }
    };

    // Rich text formatting functions
    const applyFormat = (command: 'bold' | 'italic' | 'underline') => {
        document.execCommand(command, false);
        // Update modal data with the new content
        if (contentEditorRef.current) {
            setModalData({ ...modalData, content: contentEditorRef.current.innerHTML });
        }
    };

    const handleContentChange = () => {
        if (contentEditorRef.current) {
            setModalData({ ...modalData, content: contentEditorRef.current.innerHTML });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-md border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex items-center justify-between h-14">
                        <div className="flex items-center space-x-2">
                            <a
                                href="/admin"
                                className="text-gray-700 hover:text-theme-accent transition-colors flex items-center gap-1 group"
                            >
                                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                                <span className="text-sm">Dashboard</span>
                            </a>
                            <span className="text-gray-400">•</span>
                            <h1 className="text-base font-bold text-navy-900">Article Manager</h1>
                        </div>
                        <button
                            onClick={() => openModal()}
                            className="flex items-center gap-2 bg-theme-accent text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-md text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            New Article
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="mb-4">
                    <p className="text-gray-700 text-sm">
                        Create and manage educational articles. Only enabled articles are visible to customers.
                    </p>
                </div>

                {articles.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
                        <FileText className="w-16 h-16 text-theme-secondary mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-semibold text-theme-text mb-2">
                            No Articles Yet
                        </h3>
                        <p className="text-theme-secondary mb-6">
                            Create your first educational article
                        </p>
                        <button
                            onClick={() => openModal()}
                            className="inline-flex items-center gap-2 bg-theme-accent text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                        >
                            <Plus className="w-5 h-5" />
                            Create First Article
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {articles.map((article) => (
                            <div
                                key={article.id}
                                className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <GripVertical className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-base font-semibold text-theme-text truncate">
                                                        {article.title}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${article.is_enabled
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {article.is_enabled ? 'Published' : 'Draft'}
                                                    </span>
                                                </div>
                                                {article.preview && (
                                                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                                        {article.preview}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    <span>By {article.author}</span>
                                                    <span>•</span>
                                                    <span>{new Date(article.published_date).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span>Order: {article.display_order}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => toggleEnabled(article.id, article.is_enabled)}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                                title={article.is_enabled ? 'Unpublish' : 'Publish'}
                                            >
                                                {article.is_enabled ? (
                                                    <Eye className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <EyeOff className="w-4 h-4 text-gray-400" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => openModal(article)}
                                                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                                title="Edit Article"
                                            >
                                                <Edit2 className="w-4 h-4 text-blue-600" />
                                            </button>
                                            <button
                                                onClick={() => deleteArticle(article.id)}
                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                                title="Delete Article"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl my-8">
                        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold text-theme-text">
                                    {editingArticle ? 'Edit Article' : 'Create New Article'}
                                </h3>
                                <button
                                    onClick={closeModal}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Article Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Article Title *
                                </label>
                                <input
                                    type="text"
                                    value={modalData.title}
                                    onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-transparent"
                                    placeholder="e.g., Understanding Weight Loss Plateaus and How to Overcome Them"
                                />
                            </div>

                            {/* Cover Image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cover Image (Hero Banner)
                                </label>
                                <ImageUpload
                                    currentImage={modalData.cover_image || undefined}
                                    onImageChange={(imageUrl) => setModalData({ ...modalData, cover_image: imageUrl || null })}
                                    folder="article-covers"
                                />
                            </div>

                            {/* Preview Text */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Preview Text (shown on article cards)
                                </label>
                                <textarea
                                    value={modalData.preview}
                                    onChange={(e) => setModalData({ ...modalData, preview: e.target.value })}
                                    rows={2}
                                    maxLength={150}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-transparent text-sm"
                                    placeholder="Short 1-2 line preview (max 150 characters)"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {modalData.preview.length}/150 characters
                                </p>
                            </div>

                            {/* Article Content - Rich Text Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Article Content *
                                </label>
                                {/* Formatting Toolbar */}
                                <div className="flex items-center gap-1 p-2 bg-gray-100 border border-gray-300 border-b-0 rounded-t-lg">
                                    <button
                                        type="button"
                                        onClick={() => applyFormat('bold')}
                                        className="p-2 hover:bg-gray-200 rounded transition-colors flex items-center justify-center"
                                        title="Bold (Ctrl+B)"
                                    >
                                        <Bold className="w-4 h-4 text-gray-700" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyFormat('italic')}
                                        className="p-2 hover:bg-gray-200 rounded transition-colors flex items-center justify-center"
                                        title="Italic (Ctrl+I)"
                                    >
                                        <Italic className="w-4 h-4 text-gray-700" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyFormat('underline')}
                                        className="p-2 hover:bg-gray-200 rounded transition-colors flex items-center justify-center"
                                        title="Underline (Ctrl+U)"
                                    >
                                        <Underline className="w-4 h-4 text-gray-700" />
                                    </button>
                                    <div className="h-5 w-px bg-gray-300 mx-1" />
                                    <span className="text-xs text-gray-500 ml-2">
                                        Select text, then click a button to format
                                    </span>
                                </div>
                                {/* Rich Text Editor */}
                                <div
                                    ref={contentEditorRef}
                                    contentEditable
                                    onInput={handleContentChange}
                                    onBlur={handleContentChange}
                                    dangerouslySetInnerHTML={{ __html: modalData.content }}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-theme-accent focus:border-transparent min-h-[300px] max-h-[400px] overflow-y-auto text-sm bg-white prose prose-sm max-w-none focus:outline-none"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 Tip: Select text and click <strong>B</strong> for bold, <em>I</em> for italic, or <u>U</u> for underline. Keyboard shortcuts: Ctrl+B, Ctrl+I, Ctrl+U.
                                </p>
                            </div>

                            {/* Metadata Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Author
                                    </label>
                                    <input
                                        type="text"
                                        value={modalData.author}
                                        onChange={(e) => setModalData({ ...modalData, author: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Published Date
                                    </label>
                                    <input
                                        type="date"
                                        value={modalData.published_date}
                                        onChange={(e) => setModalData({ ...modalData, published_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Display Order */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Display Order
                                </label>
                                <input
                                    type="number"
                                    value={modalData.display_order}
                                    onChange={(e) => setModalData({ ...modalData, display_order: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Lower numbers appear first in the article list
                                </p>
                            </div>

                            {/* Related Products */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Package className="w-4 h-4 inline mr-1" />
                                    Related Products (shown at article end)
                                </label>
                                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                                    {products.length === 0 ? (
                                        <p className="text-sm text-gray-500 p-3">No products available</p>
                                    ) : (
                                        products.map((product) => {
                                            const isSelected = modalData.related_product_ids.includes(product.id);
                                            return (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const newIds = isSelected
                                                            ? modalData.related_product_ids.filter(id => id !== product.id)
                                                            : [...modalData.related_product_ids, product.id];
                                                        setModalData({ ...modalData, related_product_ids: newIds });
                                                    }}
                                                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${isSelected ? 'bg-green-50' : ''}`}
                                                >
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    {product.image_url && (
                                                        <img src={optimizedImageUrl(product.image_url, 32)} alt="" className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" decoding="async" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                                        <p className="text-xs text-gray-500">₱{product.base_price.toLocaleString()}</p>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                                {modalData.related_product_ids.length > 0 && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ {modalData.related_product_ids.length} product(s) selected
                                    </p>
                                )}
                            </div>

                            {/* Enable/Disable */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_enabled"
                                    checked={modalData.is_enabled}
                                    onChange={(e) => setModalData({ ...modalData, is_enabled: e.target.checked })}
                                    className="w-5 h-5 text-theme-accent rounded focus:ring-2 focus:ring-theme-accent"
                                />
                                <label htmlFor="is_enabled" className="text-sm font-medium text-gray-700">
                                    Publish this article (make visible to customers)
                                </label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                            <button
                                onClick={closeModal}
                                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveArticle}
                                className="px-6 py-2 bg-theme-accent text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                {editingArticle ? 'Save Changes' : 'Create Article'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
