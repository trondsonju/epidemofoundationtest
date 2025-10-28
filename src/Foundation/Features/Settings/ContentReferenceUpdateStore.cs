using System.Collections.Generic;
using System.Linq;
using EPiServer;
using EPiServer.Cms.Shell.UI.Rest.Internal;
using EPiServer.Core;
using EPiServer.Core.Html.StringParsing;
using EPiServer.Data.Entity;
using EPiServer.DataAccess;
using EPiServer.Security;
using EPiServer.Shell.Services.Rest;
using EPiServer.SpecializedProperties;
using EPiServer.Web;
using Microsoft.AspNetCore.Mvc;

namespace AlloyTemplates.Business;

[RestStore("content-reference-update")]
public class ContentReferenceUpdateStore : RestControllerBase
{
    private readonly ReferencedContentResolver _referencedContentResolver;
    private readonly IContentRepository _contentRepository;

    public ContentReferenceUpdateStore(
        ReferencedContentResolver referencedContentResolver,
        IContentRepository contentRepository)
    {
        _referencedContentResolver = referencedContentResolver;
        _contentRepository = contentRepository;
    }

    [HttpPost]
    public ActionResult Post([FromBody] UpdateReferenceModel model)
    {
        if (model == null)
        {
            return BadRequest();
        }

        var references = _referencedContentResolver.GetReferenceList(new ContentReference(model.SourceReference));
        if (!string.IsNullOrWhiteSpace(model.SourceContentLinkToReplace))
        {
            var sourceContentReference = new ContentReference(model.SourceContentLinkToReplace);
            references = references.Where(x => x.ContentLink == sourceContentReference).ToList();
        }

        foreach (var reference in references)
        {
            var updated = false;
            var content = _contentRepository.Get<IContent>(reference.ContentLink);
            if (content is IReadOnly)
            {
                content = (content as IReadOnly).CreateWritableClone() as IContent;
            }

            for (var index = 0; index < content.Property.Count; index++)
            {
                var propertyData = content.Property[index];
                if (TryUpdateProperty(propertyData, new ContentReference(model.SourceReference),
                        new ContentReference(model.TargetReference)))
                {
                    updated = true;
                }
            }

            if (updated)
            {
                _contentRepository.Save(content, SaveAction.ForceCurrentVersion, AccessLevel.NoAccess);
            }
        }

        return Ok();
    }

    private bool TryUpdateProperty(PropertyData propertyData, ContentReference fromReference, ContentReference toReference)
    {
        if (propertyData.Value == null)
        {
            return false;
        }

        //
        // ContentArea
        //
        if (propertyData.Value is ContentArea)
        {
            var contentArea = propertyData.Value as ContentArea;
            if (contentArea.Items == null)
            {
                return false;
            }
            if (contentArea.Items.Any(x => x.ContentLink == fromReference.ToReferenceWithoutVersion()))
            {
                for (var index = 0; index < contentArea.Items.Count; index++)
                {
                    var contentAreaItem = contentArea.Items[index];
                    if (contentAreaItem.ContentLink == fromReference)
                    {
                        contentAreaItem.ContentLink = toReference;
                    }
                }

                return true;
            }
        }

        //
        // ContentReference
        //
        if (propertyData.Value is ContentReference)
        {
            if (((ContentReference)propertyData.Value) == fromReference)
            {
                propertyData.Value = toReference;
                return true;
            }
        }

        //
        // ContentReference list
        //
        if (propertyData.Value is IEnumerable<ContentReference>)
        {
            var references = (propertyData.Value as IEnumerable<ContentReference>).ToList();
            if (references.Any(x => x == fromReference))
            {
                propertyData.Value = references.Select(x => (x == fromReference) ? toReference : x).ToList();
                return true;
            }
        }


        if (propertyData.Value is LinkItemCollection ||
            propertyData.Value is XhtmlString ||
            propertyData.Value is LinkItem)
        {
            var hasLink = false;
            var content = _contentRepository.Get<IContent>(fromReference);
            var currentVirtualPath =
                PermanentLinkUtility.GetPermanentLinkVirtualPath(content.ContentGuid, ".aspx");
            var newContent = _contentRepository.Get<IContent>(toReference);
            var newVirtualPath = PermanentLinkUtility.GetPermanentLinkVirtualPath(newContent.ContentGuid, ".aspx");


            //
            // LinkItemCollection
            //
            if (propertyData.Value is LinkItemCollection)
            {
                var updatedList = new List<LinkItem>();
                var linkItems = (LinkItemCollection)propertyData.Value;
                for (var index = 0; index < linkItems.Count; index++)
                {
                    var linkItem = linkItems[index];
                    if (linkItem.Href == currentVirtualPath)
                    {
                        linkItem.Href = newVirtualPath;
                        linkItem.Text = newContent.Name;
                        hasLink = true;
                    }
                    updatedList.Add(linkItem);
                }

                if (hasLink)
                {
                    propertyData.Value = new LinkItemCollection(updatedList);
                    return true;
                }

                return false;
            }

            //
            // LinkItem
            //
            if (propertyData.Value is LinkItem)
            {
                var linkItem = (LinkItem)propertyData.Value;
                if (linkItem.Href == currentVirtualPath)
                {
                    var linkItemCopy = new LinkItem
                    {
                        Href = newVirtualPath,
                        Text = newContent.Name,
                        Target = linkItem.Target,
                        Title = linkItem.Title
                    };
                    linkItemCopy.Attributes.Clear();
                    foreach (var attr in linkItem.Attributes)
                    {
                        linkItemCopy.Attributes.Add(attr.Key, attr.Value);
                    }
                    linkItemCopy.Attributes["href"] = newVirtualPath;

                    propertyData.Value = linkItemCopy;
                    return true;
                }

                return false;
            }

            //
            // XhtmlString
            //
            if (propertyData.Value is XhtmlString)
            {
                var xhtml = (XhtmlString)propertyData.Value;

                var str = xhtml.ToHtmlString();

                foreach (var stringFragment in xhtml.Fragments)
                {
                    if (stringFragment is UrlFragment)
                    {
                        var urlFragment = (UrlFragment)stringFragment;
                        if (urlFragment.Url == currentVirtualPath)
                        {
                            str = str.Replace(urlFragment.Url.Replace("~", ""), newVirtualPath.Replace("~", ""));
                            hasLink = true;
                        }
                    }
                }

                if (hasLink)
                {
                    propertyData.Value = new XhtmlString(str);
                    return true;
                }

                return false;
            }
        }


        return false;
    }
}

public class UpdateReferenceModel
{
    public string SourceReference { get; set; }
    public string SourceContentLinkToReplace { get; set; }
    public string TargetReference { get; set; }
}