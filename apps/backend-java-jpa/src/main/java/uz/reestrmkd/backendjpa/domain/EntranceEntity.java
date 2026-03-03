package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "entrances")
public class EntranceEntity extends BaseEntity {

    @Column(name = "block_id", nullable = false)
    private String blockId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "block_id", insertable = false, updatable = false)
    private BuildingBlockEntity block;

    @OneToMany(mappedBy = "entrance", fetch = FetchType.LAZY)
    private List<UnitEntity> units = new ArrayList<>();

    @OneToMany(mappedBy = "entrance", fetch = FetchType.LAZY)
    private List<CommonAreaEntity> commonAreas = new ArrayList<>();

    @Column(name = "number", nullable = false)
    private Integer number;
}
