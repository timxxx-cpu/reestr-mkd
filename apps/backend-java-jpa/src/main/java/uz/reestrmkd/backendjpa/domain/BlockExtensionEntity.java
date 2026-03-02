package uz.reestrmkd.backendjpa.domain;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "block_extensions")
public class BlockExtensionEntity extends BaseEntity {
    @Column(name = "building_id", nullable = false) private String buildingId;
    @Column(name = "parent_block_id", nullable = false) private String parentBlockId;
    @Column(name = "label", nullable = false) private String label;
    @Column(name = "extension_type", nullable = false) private String extensionType = "OTHER";
    @Column(name = "construction_kind", nullable = false) private String constructionKind = "capital";
    @Column(name = "floors_count", nullable = false) private Integer floorsCount = 1;
    @Column(name = "start_floor_index", nullable = false) private Integer startFloorIndex = 1;
    @Column(name = "vertical_anchor_type", nullable = false) private String verticalAnchorType = "GROUND";
    @Column(name = "anchor_floor_key") private String anchorFloorKey;
    @Column(name = "notes") private String notes;
}